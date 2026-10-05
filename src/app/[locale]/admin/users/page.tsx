import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Users as UsersIcon, ShieldCheck, ShieldOff } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toPositiveInt } from "@/lib/errors"
import { getSessionUser } from "@/lib/admin-guard"
import { UserRowActions } from "./UserRowActions"
import { FilterSelect, SearchInput, type FilterOption } from "@/components/admin/AdminFilters"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 15

const roleVariant: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  USER: "secondary",
  ADMIN: "default",
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; role?: string; status?: string }
}) {
  const t = await getTranslations("admin")
  const tu = await getTranslations("admin.usersUi")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const viewer = await getSessionUser()

  const search = (searchParams.search ?? "").slice(0, 100)
  const role = searchParams.role === "USER" || searchParams.role === "ADMIN" ? searchParams.role : "all"
  const statusFilter = searchParams.status === "banned" || searchParams.status === "active" ? searchParams.status : "all"

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [{ name: { contains: search } }, { email: { contains: search } }]
  }
  if (role !== "all") where.role = role
  if (statusFilter === "banned") where.bannedAt = { not: null }
  if (statusFilter === "active") where.bannedAt = null

  const total = await prisma.user.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(toPositiveInt(searchParams.page ?? null, 1), totalPages)
  const skip = (page - 1) * PAGE_SIZE

  const [users, allUsers, admins, banned, activeAdmins] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        bannedAt: true,
        banReason: true,
        _count: { select: { articles: true, questions: true, software: true, answers: true, comments: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.user.count({ where: { role: "ADMIN", bannedAt: null } }),
  ])

  const roleOptions: FilterOption[] = [
    { value: "all", label: tu("roleAll") },
    { value: "USER", label: "USER" },
    { value: "ADMIN", label: "ADMIN" },
  ]
  const statusOptions: FilterOption[] = [
    { value: "all", label: tu("statusAll") },
    { value: "active", label: tu("statusActive"), count: allUsers - banned },
    { value: "banned", label: tu("statusBanned"), count: banned },
  ]

  const baseParams = { search: search || undefined, role, status: statusFilter }
  const buildHref = (nextPage: number) =>
    `/admin/users?search=${encodeURIComponent(search)}&role=${role}&status=${statusFilter}&page=${nextPage}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tu("title")}</h2>
          <p className="mt-1 text-muted-foreground">{tu("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder={tu("searchPlaceholder")}
            label={tu("searchLabel")}
            base={baseParams}
            defaultValue={search}
          />
          <FilterSelect paramKey="role" value={role} options={roleOptions} label={tu("roleLabel")} className="h-9 w-32" base={baseParams} />
          <FilterSelect paramKey="status" value={statusFilter} options={statusOptions} label={tu("statusLabel")} base={baseParams} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tu("metricTotal")}</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{allUsers.toLocaleString(locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tu("metricAdmins")}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{admins.toLocaleString(locale)}</p>
            {activeAdmins === 1 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{tu("onlyOneAdmin")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tu("metricBanned")}</CardTitle>
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{banned.toLocaleString(locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <UsersIcon className="h-5 w-5" />
          <CardTitle className="text-lg">{tu("tableTitle", { total })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tu("columnUser")}</TableHead>
                  <TableHead>{tu("columnRole")}</TableHead>
                  <TableHead>{tu("columnStatus")}</TableHead>
                  <TableHead>{tu("columnContent")}</TableHead>
                  <TableHead>{tu("columnJoined")}</TableHead>
                  <TableHead>{tu("columnLastLogin")}</TableHead>
                  <TableHead className="text-right">{tu("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {tu("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const contentCount =
                      user._count.articles +
                      user._count.questions +
                      user._count.software +
                      user._count.answers +
                      user._count.comments
                    const isLastAdmin = user.role === "ADMIN" && !user.bannedAt && activeAdmins <= 1
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium">{user.name || t("unnamed")}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleVariant[user.role] ?? "secondary"}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.bannedAt ? (
                            <Badge variant="destructive" title={user.banReason ?? undefined}>
                              {tu("statusBanned")}
                            </Badge>
                          ) : (
                            <Badge variant="success">{tu("statusActive")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">{contentCount}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt, locale)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt, locale) : tu("never")}
                        </TableCell>
                        <TableCell className="text-right">
                          <UserRowActions
                            userId={user.id}
                            email={user.email}
                            currentRole={user.role}
                            banned={Boolean(user.bannedAt)}
                            isSelf={viewer?.id === user.id}
                            isLastAdmin={isLastAdmin}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {tu("showing", { from: skip + 1, to: Math.min(page * PAGE_SIZE, total), total })}
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
                <span className="text-sm text-muted-foreground">{tu("pageOf", { page, totalPages })}</span>
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
