import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { VoteButtons } from "@/components/client/VoteButtons"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { AnswerForm } from "@/components/client/AnswerForm"
import { AcceptButton } from "@/components/client/AcceptButton"
import { Eye, Clock, User, CheckCircle, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface QuestionPageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: QuestionPageProps) {
  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    select: { title: true },
  })
  if (!question) return { title: "问题未找到" }
  return { title: question.title }
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const session = await auth()
  const userId = (session?.user as any)?.id

  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!question) notFound()

  // Increment view count
  await prisma.question.update({
    where: { id: question.id },
    data: { viewCount: { increment: 1 } },
  })

  const tags = question.tags
  const isAuthor = userId === question.author.id

  // Answers sorted: accepted first, then by votes
  const answers = await prisma.answer.findMany({
    where: { questionId: question.id },
    orderBy: [{ accepted: "desc" }, { voteCount: "desc" }],
    include: {
      author: { select: { id: true, name: true, image: true } },
      _count: { select: { comments: true } },
    },
  })

  // Get vote summaries for each answer
  const answerVotes = await Promise.all(
    answers.map(async (answer) => {
      const [up, down, userVote] = await Promise.all([
        prisma.vote.count({ where: { targetType: "answer", targetId: answer.id, value: 1 } }),
        prisma.vote.count({ where: { targetType: "answer", targetId: answer.id, value: -1 } }),
        userId
          ? prisma.vote.findUnique({
              where: {
                userId_targetType_targetId: {
                  userId,
                  targetType: "answer",
                  targetId: answer.id,
                },
              },
            })
          : null,
      ])
      return { answerId: answer.id, up, down, userVote: userVote?.value ?? null }
    })
  )

  // Question votes
  const [qUpVotes, qDownVotes, qUserVote] = await Promise.all([
    prisma.vote.count({ where: { targetType: "question", targetId: question.id, value: 1 } }),
    prisma.vote.count({ where: { targetType: "question", targetId: question.id, value: -1 } }),
    userId
      ? prisma.vote.findUnique({
          where: {
            userId_targetType_targetId: {
              userId,
              targetType: "question",
              targetId: question.id,
            },
          },
        })
      : null,
  ])

  const isBookmarked = userId
    ? !!(await prisma.bookmark.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: "question",
            targetId: question.id,
          },
        },
      }))
    : false

  // Related questions
  const relatedQuestions = await prisma.question.findMany({
    where: {
      id: { not: question.id },
      status: question.status,
    },
    orderBy: { voteCount: "desc" },
    take: 5,
    select: { id: true, slug: true, title: true, answerCount: true, voteCount: true },
  })

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">首页</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/questions" className="hover:text-foreground">问答</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate max-w-[200px]">{question.title}</span>
      </nav>

      <div className="flex gap-8">
        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Question Header */}
          <div className="mb-6">
            <h1 className="mb-3 text-2xl font-bold">{question.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="h-4 w-4" />
                {question.author.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(question.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {question.viewCount} 次浏览
              </span>
            </div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Question Content */}
          <div className="mb-6">
            <div
              className="prose-custom max-w-none"
              dangerouslySetInnerHTML={{ __html: question.content }}
            />
          </div>

          {/* Question Actions */}
          <div className="mb-8 flex items-center gap-3 border-b border-t py-4">
            <VoteButtons
              targetType="question"
              targetId={question.id}
              upVotes={qUpVotes}
              downVotes={qDownVotes}
              userVote={qUserVote?.value ?? null}
            />
            <BookmarkButton
              targetType="question"
              targetId={question.id}
              isBookmarked={isBookmarked}
            />
            <ShareButton title={question.title} />
          </div>

          {/* Answers Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">
              {answers.length} 个回答
            </h2>

            <div className="space-y-4">
              {answers.map((answer) => {
                const votes = answerVotes.find((v) => v.answerId === answer.id)!
                return (
                  <div
                    key={answer.id}
                    className={`rounded-lg border p-5 ${
                      answer.accepted ? "border-green-500 bg-green-50/30 dark:bg-green-950/10" : ""
                    }`}
                  >
                    {answer.accepted && (
                      <div className="mb-3 flex items-center gap-1 text-sm font-medium text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        已采纳
                      </div>
                    )}
                    <div className="flex gap-4">
                      {/* Vote column */}
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <VoteButtons
                          targetType="answer"
                          targetId={answer.id}
                          upVotes={votes.up}
                          downVotes={votes.down}
                          userVote={votes.userVote}
                        />
                        {isAuthor && !answer.accepted && (
                          <AcceptButton
                            answerId={answer.id}
                            questionId={question.id}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div
                          className="prose-custom max-w-none text-sm"
                          dangerouslySetInnerHTML={{ __html: answer.content }}
                        />
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{answer.author.name}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(answer.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {answers.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                暂无回答，快来写下第一个回答吧
              </p>
            )}
          </section>

          {/* Answer Form */}
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">你的回答</h2>
            <AnswerForm
              questionId={question.id}
              userId={userId}
            />
          </section>
        </div>

        {/* Sidebar - Related Questions */}
        <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block">
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">相关问题</h3>
            {relatedQuestions.length > 0 ? (
              <ul className="space-y-2">
                {relatedQuestions.map((rq) => (
                  <li key={rq.id}>
                    <Link
                      href={`/questions/${rq.slug}`}
                      className="block text-xs text-muted-foreground hover:text-foreground line-clamp-2"
                    >
                      {rq.title}
                    </Link>
                    <span className="text-[10px] text-muted-foreground">
                      {rq.answerCount} 回答 · {rq.voteCount} 票
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">暂无相关问题</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
