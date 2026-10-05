import { revalidatePath } from "next/cache";

/**
 * The public content pages are ISR-cached (60s–1h), so an admin edit used to
 * take effect only after the cache expired. Every admin mutation calls these
 * helpers to invalidate the affected paths immediately, in both locales
 * (`zh` is served without a prefix, `en` under `/en` — see i18n/routing.ts).
 */
const LOCALE_PREFIXES = ["", "/en"];

function revalidateEverywhere(path: string) {
  for (const prefix of LOCALE_PREFIXES) {
    try {
      revalidatePath(`${prefix}${path}`);
    } catch (error) {
      // revalidatePath throws outside a request scope (e.g. from a script).
      console.error("revalidatePath failed for", `${prefix}${path}`, error);
    }
  }
}

export type PublicContentType = "articles" | "questions" | "software";

const LIST_PATH: Record<PublicContentType, string> = {
  articles: "/solutions",
  questions: "/questions",
  software: "/software",
};

export function revalidateContentList(type: PublicContentType) {
  revalidateEverywhere(LIST_PATH[type]);
  revalidateEverywhere("/");
}

/** Invalidate a single detail page plus the list/home/search surfaces. */
export function revalidateContent(type: PublicContentType, slug?: string | null) {
  revalidateContentList(type);
  if (slug) revalidateEverywhere(`${LIST_PATH[type]}/${slug}`);
  revalidateEverywhere("/search");
}

/** Site-wide surfaces affected by settings/site config changes. */
export function revalidateSiteConfig() {
  revalidateEverywhere("/");
  revalidateEverywhere("/solutions");
  revalidateEverywhere("/questions");
  revalidateEverywhere("/software");
  revalidateEverywhere("/about");
  revalidateEverywhere("/contact");
}

/**
 * Invalidate every surface that renders tag names, colours or counts:
 * the homepage "hot tags" sidebar, the tag detail pages and the content
 * lists/detail pages that show tag chips.
 *
 * Pass the slugs of tags whose pages changed (a rename keeps its slug, but a
 * merge or delete removes a page entirely).
 */
export function revalidateTags(slugs: (string | null | undefined)[] = []) {
  revalidateEverywhere("/");
  revalidateEverywhere("/solutions");
  revalidateEverywhere("/questions");
  revalidateEverywhere("/software");
  revalidateEverywhere("/search");
  for (const slug of slugs) {
    if (slug) revalidateEverywhere(`/tags/${slug}`);
  }
}
