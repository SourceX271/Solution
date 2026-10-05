import { prisma } from "@/lib/db"
import { Link } from "@/i18n/routing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toPositiveInt } from "@/lib/errors"
import { getTranslations } from "next-intl/server"
import { FileText, HelpCircle, Package, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { ContentTable, type ContentRow, type ContentTypeKey } from "./ContentTable"
import { FilterSelect, SearchInput, type FilterOption } from "@/components/admin/AdminFilters"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

type ContentType = ContentTypeKey

const TYPE_ICONS: Record<ContentType, React.ComponentType<{ className?: string }>> = {
  articles: FileText,
  questions: HelpCircle,
  software: Package,
}

/** Status vocabularies the public site actually understands. */
const STATUS_OPTIONS: Record<ContentType, string[]> = {
  articles: ["published", "draft"],
  questions: ["open", "closed", "solved"],
  software: ["published", "pending"],
}

/** Which status means "visible to the public" for each type. */
const PUBLIC_STATUS: Record<ContentType, string> = {
  articles: "published",
  questions: "open",
  software: "published",
}

const CREATE_HREF: Record<ContentType, string> = {
  articles: "/solutions/new",
  questions: "/questions/ask",
  software: "/software/new",
}

const SORTS: Record<ContentType, string[]> = {
  articles: ["newest", "oldest", "views"],
  questions: ["newest", "oldest", "views"],
  software: ["newest", "oldest", "rating"],
}

function isContentType(value: string | undefined): value is ContentType {
  return value === "articles" || value === "questions" || value === "software"
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; sort?: string; search?: string; page?: string }
}) {
  const t = await getTranslations("admin")
  const tc = await getTranslations("admin.contentUi")

  const type: ContentType = isContentType(searchParams.type) ? searchParams.type : "articles"
  const status = searchParams.status && searchParams.status !== "all" ? searchParams.status : "all"
  const sort = SORTS[type].includes(searchParams.sort ?? "") ? (searchParams.sort as string) : "newest"
  const search = (searchParams.search ?? "").slice(0, 100)

  const searchWhere = search
    ? type === "software"
      ? { name: { contains: search } }
      : { title: { contains: search } }
    : {}
  const where = { ...searchWhere, ...(status !== "all" ? { status } : {}) }

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "views"
        ? type === "software"
          ? { rating: "desc" as const }
          : type === "questions"
            ? { voteCount: "desc" as const }
            : { viewCount: "desc" as const }
        : { createdAt: "desc" as const }

  const [total, statusGroups] = await Promise.all([
    type === "articles"
      ? prisma.article.count({ where })
      : type === "questions"
        ? prisma.question.count({ where })
        : prisma.software.count({ where }),
    type === "articles"
      ? prisma.article.groupBy({ by: ["status"], _count: { _all: true } })
      : type === "questions"
        ? prisma.question.groupBy({ by: ["status"], _count: { _all: true } })
        : prisma.software.groupBy({ by: ["status"], _count: { _all: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Clamp instead of rendering an empty table for ?page=999.
  const page = Math.min(toPositiveInt(searchParams.page ?? null, 1), totalPages)
  const skip = (page - 1) * PAGE_SIZE

  let items: Array<{
    id: string
    slug: string
    status: string
    createdAt: Date
    title: string
    authorName: string
    meta?: string
  }> = []

  if (type === "articles") {
    const rows = await prisma.article.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      include: { author: { select: { name: true } } },
    })
    items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
      title: row.title,
      authorName: row.author?.name || t("unnamed"),
      meta: tc("views", { count: row.viewCount }),
    }))
  } else if (type === "questions") {
    const rows = await prisma.question.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      include: { author: { select: { name: true } } },
    })
    items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
      title: row.title,
      authorName: row.author?.name || t("unnamed"),
      meta: tc("answers", { count: row.answerCount }),
    }))
  } else {
    const rows = await prisma.software.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      include: { author: { select: { name: true } } },
    })
    items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
      title: row.name,
      authorName: row.author?.name || t("unnamed"),
      meta: tc("rating", { value: row.rating.toFixed(1) }),
    }))
  }

  const counts = new Map(statusGroups.map((group) => [group.status, group._count._all]))
  const totalAll = [...counts.values()].reduce((sum, value) => sum + value, 0)

  const labels: Record<ContentType, string> = {
    articles: t("solutions"),
    questions: t("questions"),
    software: t("software"),
  }

  const statusLabel = (value: string) => {
    switch (value) {
      case "published":
        return t("statusPublished")
      case "draft":
        return t("statusDraft")
      case "open":
        return t("statusOpen")
      case "closed":
        return t("statusClosed")
      case "solved":
        return t("statusSolved")
      case "pending":
        return t("statusPending")
      default:
        return value
    }
  }

  const statusOptions: FilterOption[] = [
    { value: "all", label: tc("statusAll"), count: totalAll },
    ...STATUS_OPTIONS[type].map((value) => ({
      value,
      label: statusLabel(value),
      count: counts.get(value) ?? 0,
    })),
  ]

  const sortOptions: FilterOption[] = [
    { value: "newest", label: tc("sortNewest") },
    { value: "oldest", label: tc("sortOldest") },
    { value: "views", label: type === "software" ? tc("sortRating") : tc("sortViews") },
  ]

  const rows: ContentRow[] = items.map((item) => ({
    id: item.id,
    slug: item.slug,
    status: item.status,
    statusLabel: statusLabel(item.status),
    createdAt: item.createdAt.toISOString(),
    title: item.title,
    authorName: item.authorName,
    meta: item.meta,
  }))

  const Icon = TYPE_ICONS[type]
  const baseParams = { type, status, sort, search: search || undefined }
  const publicStatus = PUBLIC_STATUS[type]
  const publicCount = counts.get(publicStatus) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tc("title")}</h2>
          <p className="mt-1 text-muted-foreground">{tc("subtitle")}</p>
        </div>
        <Button asChild size="sm">
          <Link href={CREATE_HREF[type]}>
            <Plus className="mr-2 h-4 w-4" />
            {tc("create")}
          </Link>
        </Button>
      </div>

      {/* Content type tabs */}
      <div role="tablist" aria-label={tc("title")} className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {(Object.keys(TYPE_ICONS) as ContentType[]).map((key) => {
          const TabIcon = TYPE_ICONS[key]
          const active = type === key
          return (
            <Link
              key={key}
              href={`/admin/content?type=${key}`}
              role="tab"
              aria-selected={active}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {labels[key]}
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5" />
              {labels[type]}
              <span className="text-sm font-normal text-muted-foreground">
                {tc("totalSummary", { total, published: publicCount })}
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput placeholder={tc("searchPlaceholder")} label={tc("searchLabel")} base={baseParams} defaultValue={search} />
              <FilterSelect paramKey="status" value={status} options={statusOptions} label={tc("statusLabel")} base={baseParams} />
              <FilterSelect paramKey="sort" value={sort} options={sortOptions} label={tc("sortLabel")} className="h-9 w-36" base={baseParams} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ContentTable type={type} rows={rows} emptyLabel={tc("empty")} />

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between" aria-label={tc("pagination")}>
              <p className="text-sm text-muted-foreground">
                {tc("showing", { from: skip + 1, to: Math.min(page * PAGE_SIZE, total), total })}
              </p>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/admin/content?type=${type}&status=${status}&sort=${sort}${search ? `&search=${encodeURIComponent(search)}` : ""}&page=${Math.max(1, page - 1)}`}
                    aria-disabled={page <= 1}
                    tabIndex={page <= 1 ? -1 : undefined}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {tc("previous")}
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">
                  {tc("pageOf", { page, totalPages })}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/admin/content?type=${type}&status=${status}&sort=${sort}${search ? `&search=${encodeURIComponent(search)}` : ""}&page=${Math.min(totalPages, page + 1)}`}
                    aria-disabled={page >= totalPages}
                    tabIndex={page >= totalPages ? -1 : undefined}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                  >
                    {tc("next")}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
