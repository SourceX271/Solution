import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export type ApiLocale = "zh" | "en";

/**
 * Resolve the locale for the current request.
 *
 * API routes are excluded from the next-intl middleware, so the
 * `x-next-intl-locale` header it would normally set is not available. next-intl
 * writes a `NEXT_LOCALE` cookie on every page request instead, and same-origin
 * `fetch` calls send it automatically — that keeps API responses (including
 * error messages shown in toasts) in the language the user is browsing.
 */
export function getRequestLocale(): ApiLocale {
  const value = cookies().get("NEXT_LOCALE")?.value;
  if (value && (routing.locales as readonly string[]).includes(value)) {
    return value as ApiLocale;
  }
  return routing.defaultLocale as ApiLocale;
}

/**
 * Server-side translator usable from route handlers.
 *
 * @example
 * const t = await getApiT("api");
 * return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
 */
export async function getApiT(namespace?: string) {
  const locale = getRequestLocale();
  return namespace
    ? getTranslations({ locale, namespace })
    : getTranslations({ locale });
}
