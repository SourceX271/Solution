import Link from "next/link"
import type { Metadata } from "next"
import { getTranslations, getLocale } from "next-intl/server"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Star, ExternalLink, ChevronLeft, ChevronRight, Package, Globe, Wrench, Gamepad2, MoreHorizontal, PlusCircle, X } from "lucide-react"

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("software")
  return {
    title: t("title"),
    description: t("metaDescription"),
  }
}

/** Software descriptions are rich HTML; cards show a plain-text preview. */
function plainText(html: string, max = 200): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

const PAGE_SIZE = 12

interface SoftwarePageProps {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>
}

export default async function SoftwarePage({ searchParams }: SoftwarePageProps) {
  const t = await getTranslations("software")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const { page: pageStr, category, tag: tagSlug } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const cat = category ?? ""
  const tag = tagSlug ?? ""

  const CATEGORIES = [
    { value: "", label: t("categoryAll"), icon: Package },
    { value: "development", label: t("categoryDevelopment"), icon: Wrench },
    { value: "library", label: t("categoryLibrary"), icon: Package },
    { value: "tool", label: t("categoryTool"), icon: Wrench },
    { value: "website", label: t("categoryWebsite"), icon: Globe },
    { value: "game", label: t("categoryGame"), icon: Gamepad2 },
    { value: "other", label: t("categoryOther"), icon: MoreHorizontal },
  ]

  const CATEGORY_LABELS: Record<string, string> = {
    development: t("categoryDevelopment"),
    library: t("categoryLibrary"),
    tool: t("categoryTool"),
    website: t("categoryWebsite"),
    game: t("categoryGame"),
    other: t("categoryOther"),
  }

  const where = {
    status: "published" as const,
    ...(cat ? { category: cat } : {}),
    // Set by the "view all" links on a tag page.
    ...(tag ? { tags: { some: { slug: tag } } } : {}),
  }

  const [software, total, activeTag] = await Promise.all([
    prisma.software.findMany({
      where,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true } } },
    }),
    prisma.software.count({ where }),
    tag ? prisma.tag.findUnique({ where: { slug: tag }, select: { name: true, color: true } }) : null,
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("totalCount", { total })}</p>
          {activeTag && (
            <span
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: activeTag.color + "20", color: activeTag.color }}
            >
              {activeTag.name}
              <Link
                href="/software"
                aria-label={tc("clear")}
                className="rounded-full p-0.5 transition-colors hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </Link>
            </span>
          )}
        </div>
        <Link
          href="/software/new"
          className="btn-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-lg shadow-primary/25"
        >
          <PlusCircle className="h-4 w-4" /> {t("submit")}
        </Link>
      </div>

      {/* Category Filters */}
      <div className="mb-6 flex flex-wrap gap-2 animate-fade-in-up stagger-1">
        {CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/software${c.value ? `?category=${c.value}` : ""}`}
            className={cn(
              "pill inline-flex items-center gap-1.5 transition-all",
              cat === c.value ? "active shadow-md" : "hover:bg-primary/15"
            )}
          >
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </Link>
        ))}
      </div>

      {/* Software Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {software.map((s, i) => (
          <Link
            key={s.id}
            href={`/software/${s.slug}`}
            className={cn(
              "glass-card flex flex-col p-5 group",
              `animate-fade-in-up stagger-${Math.min(i + 1, 6)}`
            )}
          >
            {/* Header: Category + Rating */}
            <div className="mb-2.5 flex items-start justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Package className="h-3 w-3" />
                {CATEGORY_LABELS[s.category] ?? s.category}
              </span>
              {s.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {s.rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Name */}
            <h2 className="mb-1.5 font-semibold group-hover:text-primary transition-colors">
              {s.name}
            </h2>

            {/* Description */}
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {plainText(s.description)}
            </p>

            {/* Footer */}
            <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
              {s.url && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <ExternalLink className="h-3 w-3" />{t("visit")}
                </span>
              )}
              <span className="ml-auto">
                {s.author.name} · {formatDate(s.createdAt, locale)}
              </span>
            </div>

            {/* Tags */}
            {s.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {s.tags.slice(0, 3).map((tag) => (
                  <span key={tag.slug} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}

        {software.length === 0 && (
          <div className="col-span-full py-20 text-center animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t("noSoftware")}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <Link
            href={`/software?page=${page - 1}${cat ? `&category=${cat}` : ""}${tag ? `&tag=${tag}` : ""}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all hover:bg-accent shadow-sm",
              page <= 1 && "pointer-events-none opacity-40"
            )}
          >
            <ChevronLeft className="h-4 w-4" />{tc("previous")}
          </Link>
          <span className="px-4 py-2 text-sm text-muted-foreground font-medium">
            {page} / {totalPages}
          </span>
          <Link
            href={`/software?page=${page + 1}${cat ? `&category=${cat}` : ""}${tag ? `&tag=${tag}` : ""}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all hover:bg-accent shadow-sm",
              page >= totalPages && "pointer-events-none opacity-40"
            )}
          >
            {tc("next")}<ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
