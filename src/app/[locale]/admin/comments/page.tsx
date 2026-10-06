import { prisma } from "@/lib/db"
import { Link } from "@/i18n/routing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { MessageSquare, ExternalLink } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toPositiveInt } from "@/lib/errors"
import { CommentActions } from "./CommentActions"
import { SearchInput } from "@/components/admin/AdminFilters"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const query = await searchParams
  const t = await getTranslations("admin")
  const tc = await getTranslations("admin.commentsUi")
  const locale = await getLocale()

  const search = (query.search ?? "").slice(0, 100)
  const where = search
    ? {
        OR: [
          { content: { contains: search } },
          { author: { name: { contains: search } } },
          { author: { email: { contains: search } } },
        ],
      }
    : {}

  const total = await prisma.comment.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(toPositiveInt(query.page ?? null, 1), totalPages)
  const skip = (page - 1) * PAGE_SIZE

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      author: { select: { id: true, name: true, email: true } },
      article: { select: { slug: true, title: true } },
      question: { select: { slug: true, title: true } },
      software: { select: { slug: true, name: true } },
      answer: { select: { id: true, question: { select: { slug: true, title: true } } } },
      _count: { select: { replies: true } },
    },
  })

  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [totalAll, lastWeekCount, authors] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { createdAt: { gte: lastWeek } } }),
    prisma.comment.findMany({ select: { authorId: true }, distinct: ["authorId"] }),
  ])

  function targetOf(comment: (typeof comments)[number]) {
    if (comment.article) return { href: `/solutions/${comment.article.slug}`, label: comment.article.title, kind: t("articles") }
    if (comment.question) return { href: `/questions/${comment.question.slug}`, label: comment.question.title, kind: t("questions") }
    if (comment.software) return { href: `/software/${comment.software.slug}`, label: comment.software.name, kind: t("software") }
    if (comment.answer?.question)
      return {
        href: `/questions/${comment.answer.question.slug}`,
        label: comment.answer.question.title,
        kind: tc("kindAnswer"),
      }
    return null
  }

  const buildHref = (nextPage: number) =>
    `/admin/comments?search=${encodeURIComponent(search)}&page=${nextPage}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tc("title")}</h2>
          <p className="mt-1 text-muted-foreground">{tc("subtitle")}</p>
        </div>
        <SearchInput
          placeholder={tc("searchPlaceholder")}
          label={tc("searchLabel")}
          base={{}}
          defaultValue={search}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricTotal")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{totalAll.toLocaleString(locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricLastWeek")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{lastWeekCount.toLocaleString(locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tc("metricAuthors")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{authors.length.toLocaleString(locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <MessageSquare className="h-5 w-5" />
          <CardTitle className="text-lg">{tc("tableTitle", { total })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("columnContent")}</TableHead>
                  <TableHead>{tc("columnAuthor")}</TableHead>
                  <TableHead>{tc("columnTarget")}</TableHead>
                  <TableHead>{tc("columnDate")}</TableHead>
                  <TableHead className="text-right">{tc("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {tc("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  comments.map((comment) => {
                    const target = targetOf(comment)
                    return (
                      <TableRow key={comment.id}>
                        <TableCell className="max-w-[360px]">
                          <p className="line-clamp-2 text-sm" title={comment.content}>
                            {comment.content}
                          </p>
                          {comment.parentId && (
                            <Badge variant="outline" className="mt-1">
                              {tc("isReply")}
                            </Badge>
                          )}
                          {comment._count.replies > 0 && (
                            <Badge variant="secondary" className="mt-1">
                              {tc("replies", { count: comment._count.replies })}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{comment.author.name || t("unnamed")}</p>
                          <p className="text-xs text-muted-foreground">{comment.author.email}</p>
                        </TableCell>
                        <TableCell>
                          {target ? (
                            <Link
                              href={target.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[220px] items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <span className="truncate">{target.label}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          <span title={formatDate(comment.createdAt, locale)}>
                            {formatRelativeTime(comment.createdAt, locale)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <CommentActions
                            commentId={comment.id}
                            excerpt={comment.content.slice(0, 300)}
                            replyCount={comment._count.replies}
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
