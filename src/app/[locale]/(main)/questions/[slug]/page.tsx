import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { prisma } from "@/lib/db"
import { formatRelativeTime } from "@/lib/utils"
import { highlightHtmlContent } from "@/lib/highlight"
import { toRenderableHtml } from "@/lib/render"
import { sanitizeHtml } from "@/lib/sanitize"
import { renderMathInHtml } from "@/lib/math"
import { auth } from "@/lib/auth"
import { resolveSlugRedirect } from "@/lib/slug-redirect"
import { VoteButtons } from "@/components/client/VoteButtons"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { AnswerForm } from "@/components/client/AnswerForm"
import { AnswerItem } from "@/components/client/AnswerItem"
import { QuestionEditButton } from "@/components/client/QuestionEditButton"
import { ReadingProgress } from "@/components/client/ReadingProgress"
import { ViewTracker } from "@/components/client/ViewTracker"
import { Eye, Clock, User, ChevronRight, MessageCircle, CheckCircle2, Clock4 } from "lucide-react"

export const revalidate = 1800;

interface QuestionPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: QuestionPageProps) {
  const { slug } = await params
  const t = await getTranslations("questions")
  const question = await prisma.question.findUnique({
    where: { slug },
    select: { title: true },
  })
  if (!question) return { title: t("notFoundTitle") }
  return { title: question.title }
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const t = await getTranslations("questions")
  const tc = await getTranslations("common")
  const locale = await getLocale()

  const { slug } = await params
  const session = await auth()
  const userId = (session?.user as any)?.id
  const userRole = (session?.user as any)?.role

  const question = await prisma.question.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!question) {
    await resolveSlugRedirect("question", slug)
    notFound()
  }

  const tags = question.tags
  const isAuthor = userId === question.author.id
  const canEdit = isAuthor || userRole === "ADMIN"

  const answers = await prisma.answer.findMany({
    where: { questionId: question.id },
    orderBy: [{ accepted: "desc" }, { voteCount: "desc" }],
    include: {
      author: { select: { id: true, name: true, image: true } },
      _count: { select: { comments: true } },
    },
  })

  const answerVotes = await (async () => {
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) return [];

    // Batched queries instead of one query per answer (N+1 fix)
    const [upGroups, downGroups, userVotes] = await Promise.all([
      prisma.vote.groupBy({
        by: ["targetId"],
        where: { targetType: "answer", targetId: { in: answerIds }, value: 1 },
        _count: { _all: true },
      }),
      prisma.vote.groupBy({
        by: ["targetId"],
        where: { targetType: "answer", targetId: { in: answerIds }, value: -1 },
        _count: { _all: true },
      }),
      userId
        ? prisma.vote.findMany({
            where: { userId, targetType: "answer", targetId: { in: answerIds } },
            select: { targetId: true, value: true },
          })
        : [],
    ]);

    const upMap = new Map(upGroups.map((g) => [g.targetId, g._count._all]));
    const downMap = new Map(downGroups.map((g) => [g.targetId, g._count._all]));
    const userVoteMap = new Map(userVotes.map((v) => [v.targetId, v.value]));

    return answerIds.map((answerId) => ({
      answerId,
      up: upMap.get(answerId) ?? 0,
      down: downMap.get(answerId) ?? 0,
      userVote: userVoteMap.get(answerId) ?? null,
    }));
  })()

  const [qUpVotes, qDownVotes, qUserVote] = await Promise.all([
    prisma.vote.count({ where: { targetType: "question", targetId: question.id, value: 1 } }),
    prisma.vote.count({ where: { targetType: "question", targetId: question.id, value: -1 } }),
    userId
      ? prisma.vote.findUnique({
          where: { userId_targetType_targetId: { userId, targetType: "question", targetId: question.id } },
        })
      : null,
  ])

  const isBookmarked = userId
    ? !!(await prisma.bookmark.findUnique({
        where: { userId_targetType_targetId: { userId, targetType: "question", targetId: question.id } },
      }))
    : false

  const relatedQuestions = await prisma.question.findMany({
    where: { id: { not: question.id } },
    orderBy: { voteCount: "desc" },
    take: 5,
    select: { id: true, slug: true, title: true, answerCount: true, voteCount: true, status: true },
  })

  const questionContentHtml = await highlightHtmlContent(toRenderableHtml(question.content))
  const safeContent = renderMathInHtml(await sanitizeHtml(questionContentHtml))

  return (
    <>
      <ViewTracker targetType="question" targetId={question.id} />
      <ReadingProgress />
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground animate-fade-in">
          <Link href="/" className="hover:text-foreground transition-colors">{tc("home")}</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/questions" className="hover:text-foreground transition-colors">{tc("questions")}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground truncate max-w-[240px] font-medium">{question.title}</span>
        </nav>

        <div className="flex gap-8 lg:gap-10">
          {/* Main */}
          <div className="min-w-0 flex-1 animate-fade-in-up">
            {/* Header */}
            <div className="mb-6">
              <h1 className="mb-3 text-3xl font-bold tracking-tight gradient-text">{question.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">{question.author.name}</span>
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatRelativeTime(question.createdAt, locale)}
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {t("viewCount", { count: question.viewCount + 1 })}
                </span>
                {question.status === "solved" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />{t("statusSolved")}
                  </span>
                )}
                {question.status === "open" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <Clock4 className="h-3 w-3" />{t("statusOpen")}
                  </span>
                )}
              </div>
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag.slug}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: tag.color + "15", color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Edit button */}
            {canEdit && (
              <div className="mb-4 animate-fade-in-up stagger-1">
                <QuestionEditButton
                  questionId={question.id}
                  initialTitle={question.title}
                  initialContent={question.content}
                  userId={userId}
                />
              </div>
            )}

            {/* Question Content */}
            <div
              className="mb-6 prose-custom max-w-none"
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />

            {/* Vote & Actions */}
            <div className="flex items-center gap-3 border-b border-t py-4 mb-8 animate-fade-in-up">
              <VoteButtons targetType="question" targetId={question.id} upVotes={qUpVotes} downVotes={qDownVotes} userVote={qUserVote?.value ?? null} />
              <BookmarkButton targetType="question" targetId={question.id} isBookmarked={isBookmarked} />
              <ShareButton title={question.title} />
            </div>

            {/* Answers */}
            <section className="animate-fade-in-up stagger-1">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <MessageCircle className="h-5 w-5 text-primary" />
                {t("answerCount", { count: answers.length })}
              </h2>
              <div className="space-y-4">
                {answers.map((answer) => {
                  const votes = answerVotes.find((v) => v.answerId === answer.id)!
                  return (
                    <AnswerItem
                      key={answer.id}
                      answer={answer}
                      votes={votes}
                      isAuthor={isAuthor}
                      userId={userId}
                      questionId={question.id}
                    />
                  )
                })}
              </div>
              {answers.length === 0 && (
                <div className="py-12 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
                    <MessageCircle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">{t("noAnswers")}</p>
                </div>
              )}
            </section>

            {/* Answer Form */}
            <section className="mt-8 animate-fade-in-up stagger-2">
              <h2 className="mb-4 text-lg font-semibold">{t("yourAnswer")}</h2>
              <AnswerForm questionId={question.id} userId={userId} />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block">
            <div className="glass-card rounded-xl p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("relatedQuestions")}</h3>
              {relatedQuestions.length > 0 ? (
                <ul className="space-y-2.5">
                  {relatedQuestions.map((rq) => (
                    <li key={rq.id}>
                      <Link
                        href={`/questions/${rq.slug}`}
                        className="block text-xs text-muted-foreground hover:text-foreground line-clamp-2 transition-colors"
                      >
                        {rq.title}
                      </Link>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-0.5">
                          <MessageCircle className="h-2.5 w-2.5" />{rq.answerCount}
                        </span>
                        <span>{rq.voteCount} {tc("votes")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("noRelatedQuestions")}</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
