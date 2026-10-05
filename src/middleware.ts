import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Matches a leading locale segment: /en, /en/... and /en?x=1 */
const LOCALE_PREFIX = /^\/(zh|en)(?=\/|$)/;

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

  // next-intl serves non-default locales under a prefix (/en/admin/users), so
  // strip it before matching routes — otherwise "/en/admin/*" skipped the admin
  // guard entirely and exposed the whole admin area to anonymous visitors.
  const localeMatch = pathname.match(LOCALE_PREFIX);
  const base = localeMatch ? `/${localeMatch[1]}` : "";
  const route = localeMatch ? pathname.slice(base.length) || "/" : pathname;

  const isLoggedIn = !!req.auth;
  const isAdmin = (req.auth?.user as any)?.role === "ADMIN";

  if ((route === "/admin" || route.startsWith("/admin/")) && !isAdmin) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`${base}/login`, req.nextUrl));
    }
    return NextResponse.redirect(new URL(`${base}/`, req.nextUrl));
  }

  const protectedPaths = ["/profile", "/settings", "/notifications", "/questions/ask", "/solutions/new", "/software/new"];
  const isProtected = protectedPaths.some((p) => route === p || route.startsWith(`${p}/`));
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL(`${base}/login`, req.nextUrl));
  }

  const isLoginOrRegister = route === "/login" || route === "/register";
  if (isLoginOrRegister && isLoggedIn) {
    return NextResponse.redirect(new URL(`${base}/`, req.nextUrl));
  }

  return intlRes || NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|static|.*\\..*|uploads|favicon\\.ico).*)",
    "/(zh|en)/:path*",
    "/solutions/new",
    "/software/new",
  ],
};
