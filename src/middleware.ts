import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isApiRoute = pathname.startsWith("/api/");
  const isStaticFile =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname.includes(".");

  if (isApiRoute || isStaticFile) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isAdmin = (req.auth?.user as any)?.role === "ADMIN";

  const adminRegex = /^(\/(en|zh))?\/admin/;
  if (adminRegex.test(pathname) && !isAdmin) {
    const locale = pathname.startsWith("/en") ? "/en" : "";
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`${locale}/login`, nextUrl));
    }
    return NextResponse.redirect(new URL(`${locale}/`, nextUrl));
  }

  const protectedPaths = ["/profile", "/settings", "/notifications", "/questions/ask"];
  const isProtected = protectedPaths.some((p) => pathname.includes(p));
  if (isProtected && !isLoggedIn) {
    const locale = pathname.startsWith("/en") ? "/en" : "";
    return NextResponse.redirect(new URL(`${locale}/login`, nextUrl));
  }

  const isLoginOrRegister =
    pathname === "/login" || pathname === "/register" ||
    pathname === "/en/login" || pathname === "/en/register" ||
    pathname.endsWith("/login") || pathname.endsWith("/register");
  if (isLoginOrRegister && isLoggedIn) {
    const locale = pathname.startsWith("/en") ? "/en" : "";
    return NextResponse.redirect(new URL(`${locale}/`, nextUrl));
  }

  const intlRes = intlMiddleware(req);
  if (intlRes) return intlRes;

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|static|.*\\..*|uploads|favicon\\.ico).*)",
    "/(zh|en)/:path*",
  ],
};
