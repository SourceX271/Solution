import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";

/**
 * Single source of truth for "is the caller an active admin?".
 *
 * Two rules matter here and neither is provided by the JWT on its own:
 *
 * 1. The role is re-read from the database. NextAuth freezes the role inside the
 *    token at sign-in, so an admin who is demoted would otherwise keep full API
 *    access until the token expires.
 * 2. A banned account is never an admin, even while an old token is still valid.
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  bannedAt: Date | null;
}

export interface SessionUser extends AdminUser {}

/** Resolve the signed-in user from the session *and* the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true, role: true, bannedAt: true },
  });
}

export function isActiveAdmin(user: SessionUser | null): user is SessionUser {
  return !!user && user.role === "ADMIN" && !user.bannedAt;
}

export type AdminGuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Guard for every `/api/admin/**` route handler.
 *
 * @example
 * const guard = await requireAdminApi()
 * if (!guard.ok) return guard.response
 */
export async function requireAdminApi(): Promise<AdminGuardResult> {
  const t = await getApiT("api");
  const user = await getSessionUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: t("unauthorized") }, { status: 401 }),
    };
  }

  if (!isActiveAdmin(user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: t("forbidden") }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
