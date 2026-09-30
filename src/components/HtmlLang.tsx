"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/**
 * The root layout must render a single <html> for every route, so it cannot
 * know the locale. Keep document.documentElement.lang in sync with the active
 * locale so screen readers and translation tools announce the right language.
 */
export function HtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    if (locale && document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
