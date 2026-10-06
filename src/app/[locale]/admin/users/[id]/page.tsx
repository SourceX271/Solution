import { notFound } from "next/navigation"
import { Link } from "@/i18n/routing"
import { prisma } from "@/lib/db"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { getSessionUser } from "@/lib/admin-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AuditActionBadge } from "@/components/admin/AuditActionBadge"
import { UserRowActions } from "../UserRowActions"
import { ArrowLeft, Mail, CalendarDays, Clock, Pencil } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminUserDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const t = await getTranslations("admin")
  const tu = await getTranslations("admin.usersUi")
  const locale = await getLocale()
  const viewer = await getSessionUser()

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      createdAt: true,
      lastLoginAt: true,
      bannedAt: true,
      banReason: true,
      _count: {
        select: {
          articles: true,
          questions: true,
          answers: true,
          software: true,
          comments: true,
          votes: true,
          bookmarks: true,
          notifications: true,
        },
      },
    },
  })

  if (!user) notFound()

  const [activeAdmins, articles, questions, software, comments, audit] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN", bannedAt: null } }),
    prisma.article.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, slug: true, status: true, createdAt: true },
    }),
    prisma.question.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, slug: true, status: true, createdAt: true },
    }),
    prisma.software.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, status: true, createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        createdAt: true,
        article: { select: { slug: true, title: true } },
        question: { select: { slug: true, title: true } },
        software: { select: { slug: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ targetId: user.id }, { actorId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  const stats = [
    { key: "articles", label: t("articles"), value: user._count.articles },
    { key: "questions", label: t("questions"), value: user._count.questions },
    { key: "answers", label: tu("metricAnswers"), value: user._count.answers },
    { key: "software", label: t("software"), value: user._count.software },
    { key: "comments", label: tu("metricComments"), value: user._count.comments },
    { key: "votes", label: tu("metricVotes"), value: user._count.votes },
    { key: "bookmarks", label: tu("metricBookmarks"), value: user._count.bookmarks },
    { key: "notifications", label: tu("metricNotifications"), value: user._count.notifications },
  ]

  const isLastAdmin = user.role === "ADMIN" && !user.bannedAt && activeAdmins <= 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tu("backToUsers")}
          </Link>
        </Button>
        <UserRowActions
          userId={user.id}
          email={user.email}
          currentRole={user.role}
          banned={Boolean(user.bannedAt)}
          isSelf={viewer?.id === user.id}
          isLastAdmin={isLastAdmin}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-5 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-white">
            {(user.name ?? user.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{user.name || t("unnamed")}</h2>
              <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
              {user.bannedAt ? (
                <Badge variant="destructive">{tu("statusBanned")}</Badge>
              ) : (
                <Badge variant="success">{tu("statusActive")}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {tu("joined")}: {formatDate(user.createdAt, locale)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {tu("lastLogin")}: {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt, locale) : tu("never")}
              </span>
            </div>
            {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
            {user.banReason && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {tu("banReason")}: {user.banReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">ID: {user.id}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString(locale)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tu("authoredContent")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {articles.length + questions.length + software.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{tu("noContent")}</p>
            ) : (
              <>
                {articles.map((article) => (
                  <div key={article.id} className="flex items-center gap-3 border-b pb-2 text-sm last:border-0">
                    <Badge variant="secondary">{t("articles")}</Badge>
                    <span className="min-w-0 flex-1 truncate">{article.title}</span>
                    <Badge variant={article.status === "published" ? "success" : "warning"}>{article.status}</Badge>
                    <Button asChild variant="ghost" size="icon" aria-label={t("contentEdit")}>
                      <Link href={`/admin/content/articles/${article.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center gap-3 border-b pb-2 text-sm last:border-0">
                    <Badge variant="secondary">{t("questions")}</Badge>
                    <span className="min-w-0 flex-1 truncate">{question.title}</span>
                    <Badge variant={question.status === "solved" ? "default" : "secondary"}>{question.status}</Badge>
                    <Button asChild variant="ghost" size="icon" aria-label={t("contentEdit")}>
                      <Link href={`/admin/content/questions/${question.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
                {software.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-b pb-2 text-sm last:border-0">
                    <Badge variant="secondary">{t("software")}</Badge>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <Badge variant={item.status === "published" ? "success" : "warning"}>{item.status}</Badge>
                    <Button asChild variant="ghost" size="icon" aria-label={t("contentEdit")}>
                      <Link href={`/admin/content/software/${item.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tu("recentComments")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{tu("noComments")}</p>
            ) : (
              comments.map((comment) => {
                const target =
                  comment.article?.title ?? comment.question?.title ?? comment.software?.name ?? null
                return (
                  <div key={comment.id} className="space-y-1 border-b pb-2 text-sm last:border-0">
                    <p className="line-clamp-2">{comment.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {target ? `${tu("on")}: ${target} · ` : ""}
                      {formatRelativeTime(comment.createdAt, locale)}
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tu("accountAudit")}</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tu("noAudit")}</p>
          ) : (
            <ul className="space-y-2">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <AuditActionBadge action={entry.action} />
                  <span className="text-muted-foreground">{entry.actorEmail}</span>
                  {entry.targetLabel && <Separator orientation="vertical" className="h-4" />}
                  {entry.targetLabel && <span className="truncate">{entry.targetLabel}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatRelativeTime(entry.createdAt, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
