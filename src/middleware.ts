import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAdmin = (req.auth?.user as any)?.role === "ADMIN";

  if (nextUrl.pathname.startsWith("/admin") && !isAdmin) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Protect routes that require authentication
  const protectedPaths = ["/profile", "/settings", "/notifications", "/questions/ask"];
  if (protectedPaths.some((p) => nextUrl.pathname.startsWith(p)) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if ((nextUrl.pathname === "/login" || nextUrl.pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/questions/ask",
    "/login",
    "/register",
  ],
};
