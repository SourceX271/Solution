import { getTranslations } from "next-intl/server"
import { FileQuestion } from "lucide-react"
import { Link } from "@/i18n/routing"

/**
 * Localized 404.
 *
 * Without this file every `notFound()` call (unknown content slug, missing tag,
 * deleted question…) fell through to Next's built-in English
 * "404 / This page could not be found", rendered *outside* this layout — no
 * navbar, no footer, no way back into the site.
 */
export default async function NotFound() {
  const t = await getTranslations("errors")
  const tc = await getTranslations("common")

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-bold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notFoundDescription")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {tc("backToSite")}
      </Link>
    </main>
  )
}
