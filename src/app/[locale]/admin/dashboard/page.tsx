import { prisma } from "@/lib/db"
import { cn } from "@/lib/utils"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { Link } from "@/i18n/routing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users, FileText, HelpCircle, Package, MessageSquare, Eye, TrendingUp, TrendingDown,
  Radio, ShieldAlert, Plus, Settings, ArrowRight, CheckCircle2, AlertTriangle,
} from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { ActivityChart, type ActivityPoint } from "./ActivityChart"
import { AuditActionBadge } from "@/components/admin/AuditActionBadge"

export const dynamic = "force-dynamic"

const DAY = 24 * 60 * 60 * 1000
const CHART_DAYS = 14

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export default async function DashboardPage() {
  const t = await getTranslations("admin")
  const locale = await getLocale()
  const now = new Date()
  const since14 = new Date(now.getTime() - CHART_DAYS * DAY)
  const since30 = new Date(now.getTime() - 30 * DAY)
  const previous30 = new Date(now.getTime() - 60 * DAY)
  const since7 = new Date(now.getTime() - 7 * DAY)

  const [
    userCount,
    articleCount,
    questionCount,
    softwareCount,
    commentCount,
    answerCount,
    viewsAggregate,
    newUsers30,
    newUsersPrev30,
    newArticles30,
    newArticlesPrev30,
    drafts,
    pendingSoftware,
    unanswered,
    bannedUsers,
    failedCrawls,
    auditEntries,
    recentArticles,
    recentQuestions,
    crawlSources,
    enabledSources,
    lastCrawl,
    recentUsers,
    recentUsersRaw,
    recentArticlesRaw,
    recentQuestionsRaw,
    recentCommentsRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.article.count(),
    prisma.question.count(),
    prisma.software.count(),
    prisma.comment.count(),
    prisma.answer.count(),
    prisma.article.aggregate({ _sum: { viewCount: true } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.user.count({ where: { createdAt: { gte: previous30, lt: since30 } } }),
    prisma.article.count({ where: { createdAt: { gte: since30 } } }),
    prisma.article.count({ where: { createdAt: { gte: previous30, lt: since30 } } }),
    prisma.article.count({ where: { status: "draft" } }),
    prisma.software.count({ where: { status: "pending" } }),
    prisma.question.count({ where: { status: "open", answerCount: 0 } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.crawlLog.count({ where: { status: "error", createdAt: { gte: since7 } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.article.findMany({
      where: { status: "draft" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.question.findMany({
      where: { status: "open", answerCount: 0 },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.crawlSource.count(),
    prisma.crawlSource.count({ where: { enabled: true } }),
    prisma.crawlLog.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true, bannedAt: true },
    }),
    prisma.user.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.article.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.question.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.comment.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
  ])

  const delta = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100)
  const userDelta = delta(newUsers30, newUsersPrev30)
  const articleDelta = delta(newArticles30, newArticlesPrev30)

  const stats = [
    {
      key: "users",
      label: t("dashboardUi.statsUsers"),
      value: userCount,
      delta: userDelta,
      hint: t("dashboardUi.newIn30", { count: newUsers30 }),
      icon: Users,
      gradient: "from-sky-500 to-cyan-500",
      href: "/admin/users",
    },
    {
      key: "articles",
      label: t("articles"),
      value: articleCount,
      delta: articleDelta,
      hint: t("dashboardUi.newIn30", { count: newArticles30 }),
      icon: FileText,
      gradient: "from-emerald-500 to-teal-500",
      href: "/admin/content?type=articles",
    },
    {
      key: "questions",
      label: t("questions"),
      value: questionCount,
      delta: null,
      hint: t("dashboardUi.answersHint", { count: answerCount }),
      icon: HelpCircle,
      gradient: "from-amber-500 to-orange-500",
      href: "/admin/content?type=questions",
    },
    {
      key: "software",
      label: t("software"),
      value: softwareCount,
      delta: null,
      hint: t("dashboardUi.pendingHint", { count: pendingSoftware }),
      icon: Package,
      gradient: "from-violet-500 to-fuchsia-500",
      href: "/admin/content?type=software",
    },
    {
      key: "comments",
      label: t("dashboardUi.statsComments"),
      value: commentCount,
      delta: null,
      hint: t("dashboardUi.commentsHint"),
      icon: MessageSquare,
      gradient: "from-pink-500 to-rose-500",
      href: "/admin/comments",
    },
    {
      key: "views",
      label: t("dashboardUi.statsViews"),
      value: viewsAggregate._sum.viewCount ?? 0,
      delta: null,
      hint: t("dashboardUi.viewsHint"),
      icon: Eye,
      gradient: "from-indigo-500 to-blue-500",
      href: "/admin/content?type=articles&sort=views",
    },
  ]

  // Bucket the last two weeks of activity. The dataset is small enough that
  // fetching only the timestamps and grouping in memory is cheaper than a
  // database-specific date_trunc.
  const buckets = new Map<string, ActivityPoint>()
  for (let index = CHART_DAYS - 1; index >= 0; index--) {
    const date = new Date(now.getTime() - index * DAY)
    buckets.set(dayKey(date), { label: dayKey(date), users: 0, articles: 0, questions: 0, comments: 0 })
  }
  for (const [rows, key] of [
    [recentUsersRaw, "users"],
    [recentArticlesRaw, "articles"],
    [recentQuestionsRaw, "questions"],
    [recentCommentsRaw, "comments"],
  ] as const) {
    for (const row of rows) {
      const bucket = buckets.get(dayKey(row.createdAt))
      if (bucket) bucket[key] += 1
    }
  }
  const activity = [...buckets.values()]

  const queue = [
    {
      key: "drafts",
      label: t("dashboardUi.queueDrafts"),
      count: drafts,
      href: "/admin/content?type=articles&status=draft",
      icon: FileText,
    },
    {
      key: "unanswered",
      label: t("dashboardUi.queueUnanswered"),
      count: unanswered,
      href: "/admin/content?type=questions&status=open",
      icon: HelpCircle,
    },
    {
      key: "crawler",
      label: t("dashboardUi.queueCrawlerErrors"),
      count: failedCrawls,
      href: "/admin/crawler",
      icon: Radio,
    },
    {
      key: "banned",
      label: t("dashboardUi.queueBanned"),
      count: bannedUsers,
      href: "/admin/users?status=banned",
      icon: ShieldAlert,
    },
  ]
  const totalPending = drafts + pendingSoftware + unanswered + failedCrawls

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight gradient-text">{t("dashboardUi.title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("dashboardUi.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/content">
              <FileText className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionReviewContent")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">
              <Users className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionManageUsers")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/solutions/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionNewArticle")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Headline numbers — all computed from the database. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat, index) => (
          <Link key={stat.key} href={stat.href} className="group">
            <Card
              className={cn(
                "h-full overflow-hidden border-0 shadow-md transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg",
                `animate-fade-in-up stagger-${index + 1}`
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm",
                    stat.gradient
                  )}
                >
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString(locale)}</div>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {stat.delta !== null && stat.delta !== 0 ? (
                    stat.delta > 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    )
                  ) : null}
                  {stat.delta !== null && stat.delta !== 0
                    ? t("dashboardUi.vsPrevious", { value: `${stat.delta > 0 ? "+" : ""}${stat.delta}` })
                    : stat.hint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboardUi.activityTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart
              data={activity}
              title={t("dashboardUi.activityTitle")}
              description={t("dashboardUi.activityDesc", { days: CHART_DAYS })}
              emptyLabel={t("dashboardUi.activityEmpty", { days: CHART_DAYS })}
              seriesLabels={{
                users: t("dashboardUi.activityUsers"),
                articles: t("dashboardUi.activityArticles"),
                questions: t("dashboardUi.activityQuestions"),
                comments: t("dashboardUi.statsComments"),
              }}
            />
          </CardContent>
        </Card>

        {/* Moderation queue */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t("dashboardUi.queueTitle")}</CardTitle>
            {totalPending === 0 ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t("dashboardUi.queueClear")}
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {totalPending}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <span className={cn("font-semibold tabular-nums", item.count > 0 && "text-amber-600 dark:text-amber-400")}>
                  {item.count}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}

            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{t("dashboardUi.crawlerSources")}</span>
                <span className="font-medium text-foreground">
                  {enabledSources}/{crawlSources}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>{t("dashboardUi.crawlerLastRun")}</span>
                <span className="font-medium text-foreground">
                  {lastCrawl ? formatRelativeTime(lastCrawl.createdAt, locale) : t("dashboardUi.crawlerNever")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Needs review */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t("dashboardUi.reviewQueueTitle")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/content?type=articles&status=draft">{t("dashboardUi.viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentArticles.length === 0 && recentQuestions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("noData")}</p>
            ) : (
              <>
                {recentArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/admin/content/articles/${article.id}/edit`}
                    className="block rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <p className="truncate font-medium">{article.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("statusDraft")} · {formatDate(article.createdAt, locale)}
                    </p>
                  </Link>
                ))}
                {recentQuestions.map((question) => (
                  <Link
                    key={question.id}
                    href={`/admin/content/questions/${question.id}/edit`}
                    className="block rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <p className="truncate font-medium">{question.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboardUi.queueUnanswered")} · {formatDate(question.createdAt, locale)}
                    </p>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Newest members */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t("recentUsers")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/users">{t("dashboardUi.viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("noData")}</p>
            ) : (
              recentUsers.map((user) => (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name || t("unnamed")}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.bannedAt ? "destructive" : user.role === "ADMIN" ? "default" : "secondary"}>
                    {user.bannedAt ? t("usersUi.statusBanned") : user.role}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Audit trail */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t("dashboardUi.recentActivity")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/audit">{t("dashboardUi.viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditEntries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("dashboardUi.recentActivityEmpty")}</p>
            ) : (
              auditEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 border-b pb-2 text-sm last:border-0">
                  <AuditActionBadge action={entry.action} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.actorEmail} · {formatRelativeTime(entry.createdAt, locale)}
                    </p>
                    {entry.targetLabel && (
                      <p className="truncate text-xs font-medium">{entry.targetLabel}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="text-sm font-medium text-muted-foreground">{t("dashboardUi.quickActions")}</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crawler">
              <Radio className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionRunCrawler")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/comments">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionModerateComments")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/settings">
              <Settings className="mr-2 h-4 w-4" />
              {t("dashboardUi.actionSiteSettings")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
