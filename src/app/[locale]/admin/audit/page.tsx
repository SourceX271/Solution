import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ScrollText } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toPositiveInt } from "@/lib/errors"
import { AUDIT_ACTIONS } from "@/lib/audit"
import { AuditActionBadge } from "@/components/admin/AuditActionBadge"
import { FilterSelect, SearchInput, type FilterOption } from "@/components/admin/AdminFilters"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 25

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; search?: string; page?: string }>
}) {
  const query = await searchParams
  const tc = await getTranslations("admin.auditUi")
  const locale = await getLocale()

  const action =
    query.action && AUDIT_ACTIONS.includes(query.action as never)
      ? query.action
      : "all"
  const search = (query.search ?? "").slice(0, 100)

  const where: Record<string, unknown> = {}
  if (action !== "all") where.action = action
  if (search) {
    where.OR = [
      { actorEmail: { contains: search } },
      { targetLabel: { contains: search } },
      { targetId: { contains: search } },
    ]
  }

  const total = await prisma.auditLog.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(toPositiveInt(query.page ?? null, 1), totalPages)
  const skip = (page - 1) * PAGE_SIZE

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
  })

  const actionOptions: FilterOption[] = [
    { value: "all", label: tc("actionAll") },
    ...AUDIT_ACTIONS.map((value) => ({ value, label: value })),
  ]

  const baseParams = { action, search: search || undefined }
  const buildHref = (nextPage: number) =>
    `/admin/audit?action=${action}&search=${encodeURIComponent(search)}&page=${nextPage}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tc("title")}</h2>
          <p className="mt-1 text-muted-foreground">{tc("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder={tc("searchPlaceholder")}
            label={tc("searchLabel")}
            base={baseParams}
            defaultValue={search}
          />
          <FilterSelect
            paramKey="action"
            value={action}
            options={actionOptions}
            label={tc("actionLabel")}
            className="h-9 w-56"
            base={baseParams}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <ScrollText className="h-5 w-5" />
          <CardTitle className="text-lg">{tc("tableTitle", { total })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("columnTime")}</TableHead>
                  <TableHead>{tc("columnActor")}</TableHead>
                  <TableHead>{tc("columnAction")}</TableHead>
                  <TableHead>{tc("columnTarget")}</TableHead>
                  <TableHead>{tc("columnDetails")}</TableHead>
                  <TableHead>{tc("columnIp")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {tc("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <span title={formatDate(entry.createdAt, locale)}>
                          {formatRelativeTime(entry.createdAt, locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{entry.actorEmail ?? entry.actorId}</TableCell>
                      <TableCell>
                        <AuditActionBadge action={entry.action} />
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        {entry.targetType && (
                          <span className="mr-1 text-xs text-muted-foreground">{entry.targetType}</span>
                        )}
                        {entry.targetLabel ? (
                          <span className="truncate" title={entry.targetLabel}>
                            {entry.targetLabel.slice(0, 60)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {entry.metadata ? (
                          <code
                            className="block truncate rounded bg-muted px-1.5 py-0.5 text-[11px]"
                            title={entry.metadata}
                          >
                            {entry.metadata}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.ip ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {tc("showing", { from: skip + 1, to: Math.min(page * PAGE_SIZE, total), total })}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={buildHref(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={`inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                  {tc("previous")}
                </a>
                <span className="text-sm text-muted-foreground">{tc("pageOf", { page, totalPages })}</span>
                <a
                  href={buildHref(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                  tabIndex={page >= totalPages ? -1 : undefined}
                  className={`inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                >
                  {tc("next")}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
