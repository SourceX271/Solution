import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { SearchInput } from "@/components/admin/AdminFilters"
import { Link } from "@/i18n/routing"
import { Tag as TagIcon, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { TagRowActions } from "./TagRowActions"
import { RecomputeButton } from "./RecomputeButton"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const query = await searchParams
  const t = await getTranslations("admin.tagsUi")
  const locale = await getLocale()

  const q = (query.q ?? "").trim()
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1)
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
          { description: { contains: q } },
        ],
      }
    : {}

  const [tags, total, allForMerge, driftRows] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        usageCount: true,
        createdAt: true,
        _count: { select: { articles: true, questions: true, software: true } },
      },
    }),
    prisma.tag.count({ where }),
    // Merge targets are picked from every tag, not just the current page.
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // usageCount is denormalized: surface how many rows disagree with reality.
    prisma.tag.findMany({
      select: {
        usageCount: true,
        _count: { select: { articles: true, questions: true, software: true } },
      },
    }),
  ])

  const driftCount = driftRows.filter(
    (row) =>
      row.usageCount !== row._count.articles + row._count.questions + row._count.software
  ).length

  const rows = tags.map(({ _count, ...tag }) => ({
    ...tag,
    actualCount: _count.articles + _count.questions + _count.software,
  }))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const baseParams = { q: q || undefined }
  const pageHref = (next: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (next > 1) params.set("page", String(next))
    const query = params.toString()
    return `/admin/tags${query ? `?${query}` : ""}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TagIcon className="h-5 w-5" />
            {t("tableTitle", { total })}
            {driftCount > 0 && (
              <Badge variant="warning" className="ml-1 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {driftCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              paramKey="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              label={t("searchLabel")}
              base={baseParams}
            />
            <RecomputeButton driftCount={driftCount} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnName")}</TableHead>
                <TableHead>{t("columnSlug")}</TableHead>
                <TableHead>{t("columnUsage")}</TableHead>
                <TableHead>{t("columnCreated")}</TableHead>
                <TableHead className="text-right">{t("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((tag) => {
                  const drifted = tag.usageCount !== tag.actualCount
                  return (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border"
                            style={{ backgroundColor: tag.color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium">{tag.name}</span>
                        </div>
                        {tag.description && (
                          <p className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground">
                            {tag.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tag.slug}
                      </TableCell>
                      <TableCell>
                        <span className={cn(drifted && "text-amber-600 dark:text-amber-400")}>
                          {drifted
                            ? t("usageDrift", { stored: tag.usageCount, actual: tag.actualCount })
                            : tag.actualCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(tag.createdAt, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <TagRowActions
                          tag={{
                            id: tag.id,
                            name: tag.name,
                            slug: tag.slug,
                            color: tag.color,
                            description: tag.description,
                            actualCount: tag.actualCount,
                          }}
                          candidates={allForMerge.filter((candidate) => candidate.id !== tag.id)}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("showing", { from, to, total })}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={pageHref(page - 1)}
                  aria-disabled={page <= 1}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent",
                    page <= 1 && "pointer-events-none opacity-40"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("previous")}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {t("pageOf", { page, totalPages })}
                </span>
                <Link
                  href={pageHref(page + 1)}
                  aria-disabled={page >= totalPages}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent",
                    page >= totalPages && "pointer-events-none opacity-40"
                  )}
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
