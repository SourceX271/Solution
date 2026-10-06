import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Radio, ExternalLink } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toPositiveInt } from "@/lib/errors"
import { CrawlerActions } from "./CrawlerActions"
import { AddSourceForm } from "./AddSourceForm"
import { RunAllButton } from "./RunAllButton"
import { FilterSelect, type FilterOption } from "@/components/admin/AdminFilters"

export const dynamic = "force-dynamic"

const LOG_PAGE_SIZE = 20

export default async function CrawlerPage({
  searchParams,
}: {
  searchParams: Promise<{ logStatus?: string; logPage?: string }>
}) {
  const query = await searchParams
  const tc = await getTranslations("admin.crawlerUi")
  const tcommon = await getTranslations("common")
  const locale = await getLocale()

  const logStatus =
    query.logStatus === "success" || query.logStatus === "error"
      ? query.logStatus
      : "all"

  const logWhere = logStatus === "all" ? {} : { status: logStatus }

  const [sources, logsTotal, failedLast24, lastSuccess] = await Promise.all([
    prisma.crawlSource.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.crawlLog.count({ where: logWhere }),
    prisma.crawlLog.count({
      where: { status: "error", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.crawlLog.findFirst({ where: { status: "success" }, orderBy: { createdAt: "desc" } }),
  ])

  const logTotalPages = Math.max(1, Math.ceil(logsTotal / LOG_PAGE_SIZE))
  const logPage = Math.min(toPositiveInt(query.logPage ?? null, 1), logTotalPages)
  const crawlLogs = await prisma.crawlLog.findMany({
    where: logWhere,
    orderBy: { createdAt: "desc" },
    skip: (logPage - 1) * LOG_PAGE_SIZE,
    take: LOG_PAGE_SIZE,
  })

  const statusOptions: FilterOption[] = [
    { value: "all", label: tc("logStatusAll") },
    { value: "success", label: tc("logStatusSuccess") },
    { value: "error", label: tc("logStatusError") },
  ]

  const logHref = (nextPage: number) => `/admin/crawler?logStatus=${logStatus}&logPage=${nextPage}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tc("title")}</h2>
          <p className="mt-1 text-muted-foreground">{tc("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunAllButton />
          <AddSourceForm />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricSources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{sources.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tc("metricEnabled", { count: sources.filter((source) => source.enabled).length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricFailed24h")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{failedLast24}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricLastSuccess")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {lastSuccess ? formatRelativeTime(lastSuccess.createdAt, locale) : tc("never")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            <CardTitle className="text-lg">{tc("sourcesTitle", { count: sources.length })}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("columnName")}</TableHead>
                  <TableHead>{tc("columnUrl")}</TableHead>
                  <TableHead>{tc("columnCategory")}</TableHead>
                  <TableHead>{tc("columnStatus")}</TableHead>
                  <TableHead>{tc("columnLastRun")}</TableHead>
                  <TableHead className="text-right">{tc("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {tc("noSources")}
                    </TableCell>
                  </TableRow>
                ) : (
                  sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {source.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{source.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.enabled ? "success" : "secondary"}>
                          {source.enabled ? tc("enabled") : tc("disabled")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {source.lastRun ? formatDate(source.lastRun, locale) : tc("never")}
                      </TableCell>
                      <TableCell className="text-right">
                        <CrawlerActions
                          sourceId={source.id}
                          sourceName={source.name}
                          enabled={source.enabled}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">{tc("logsTitle", { total: logsTotal })}</CardTitle>
              <CardDescription>{tc("logsDesc")}</CardDescription>
            </div>
          </div>
          <FilterSelect
            paramKey="logStatus"
            value={logStatus}
            options={statusOptions}
            label={tc("logStatusLabel")}
            base={{}}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("logColumnSource")}</TableHead>
                  <TableHead>{tc("logColumnStatus")}</TableHead>
                  <TableHead>{tc("logColumnFound")}</TableHead>
                  <TableHead>{tc("logColumnAdded")}</TableHead>
                  <TableHead>{tc("logColumnMessage")}</TableHead>
                  <TableHead>{tc("logColumnTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crawlLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {tc("noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  crawlLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.sourceName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "success"
                              : log.status === "error"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{log.itemsFound}</TableCell>
                      <TableCell className="tabular-nums">{log.itemsAdded}</TableCell>
                      <TableCell
                        className="max-w-[240px] truncate text-muted-foreground"
                        title={log.message ?? undefined}
                      >
                        {log.message || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <span title={formatDate(log.createdAt, locale)}>
                          {formatRelativeTime(log.createdAt, locale)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {logTotalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {tc("showing", {
                  from: (logPage - 1) * LOG_PAGE_SIZE + 1,
                  to: Math.min(logPage * LOG_PAGE_SIZE, logsTotal),
                  total: logsTotal,
                })}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={logHref(Math.max(1, logPage - 1))}
                  aria-disabled={logPage <= 1}
                  tabIndex={logPage <= 1 ? -1 : undefined}
                  className={`inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${logPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                  {tcommon("previous")}
                </a>
                <span className="text-sm text-muted-foreground">
                  {tc("pageOf", { page: logPage, totalPages: logTotalPages })}
                </span>
                <a
                  href={logHref(Math.min(logTotalPages, logPage + 1))}
                  aria-disabled={logPage >= logTotalPages}
                  tabIndex={logPage >= logTotalPages ? -1 : undefined}
                  className={`inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${logPage >= logTotalPages ? "pointer-events-none opacity-50" : ""}`}
                >
                  {tcommon("next")}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
