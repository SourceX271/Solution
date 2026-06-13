import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Skip API and static
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname.match(/\.\w+$/)) {
    return NextResponse.next();
  }

  // Run i18n middleware — return early if it redirects
  const intlRes = intlMiddleware(req as any);
  if (intlRes) {
    const location = intlRes.headers.get("location");
    if (location) return intlRes;
  }

  // Auth checks
  const isLoggedIn = !!req.auth;
  const isAdmin = (req.auth?.user as any)?.role === "ADMIN";

  if (pathname.startsWith("/admin") && !isAdmin) {
    const base = pathname.startsWith("/en") ? "/en" : "";
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`${base}/login`, req.nextUrl));
    }
    return NextResponse.redirect(new URL(`${base}/`, req.nextUrl));
  }

  const protectedPaths = ["/profile", "/settings", "/notifications", "/questions/ask", "/docs/new", "/software/new"];
  const isProtected = protectedPaths.some((p) => pathname.includes(p));
  if (isProtected && !isLoggedIn) {
    const base = pathname.startsWith("/en") ? "/en" : "";
    return NextResponse.redirect(new URL(`${base}/login`, req.nextUrl));
  }

  const isLoginOrRegister = pathname.endsWith("/login") || pathname.endsWith("/register");
  if (isLoginOrRegister && isLoggedIn) {
    const base = pathname.startsWith("/en") ? "/en" : "";
    return NextResponse.redirect(new URL(`${base}/`, req.nextUrl));
  }

  return intlRes || NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|static|.*\\..*|uploads|favicon\\.ico).*)",
    "/(zh|en)/:path*",
    "/docs/new",
    "/software/new",
  ],
};
