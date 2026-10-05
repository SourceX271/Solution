import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getLoginSchema } from "@/lib/validations";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role as "USER" | "ADMIN";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role as "USER" | "ADMIN";
      }
      return session;
    },
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, request) {
        // No translator here on purpose: this module is imported by the Edge
        // middleware bundle, so it must not pull in `next-intl/server`. The
        // schema messages are never shown anyway — invalid input simply fails
        // the sign-in and the login page renders its own localized error.
        const parsed = getLoginSchema().safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Throttle credential guessing per IP + account. Without this the
        // credentials endpoint accepted unlimited attempts.
        if (request) {
          const { allowed } = checkRateLimit(
            getRateLimitKey(request as Request, `login:${email.toLowerCase()}`),
            { windowMs: 10 * 60 * 1000, maxRequests: 10 }
          );
          if (!allowed) return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        // Banned accounts cannot start a new session. (Existing JWT sessions are
        // invalidated for privileged surfaces by lib/admin-guard.ts, which
        // re-reads the flag from the database on every admin request.)
        if (user.bannedAt) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        // Best-effort "last seen" marker for the admin user list.
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as "USER" | "ADMIN",
        };
      },
    }),
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
