import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatRelativeTime } from "@/lib/utils"
import { highlightHtmlContent } from "@/lib/highlight"
import { auth } from "@/lib/auth"
import { VoteButtons } from "@/components/client/VoteButtons"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { AnswerForm } from "@/components/client/AnswerForm"
import { AnswerItem } from "@/components/client/AnswerItem"
import { QuestionEditButton } from "@/components/client/QuestionEditButton"
import { RichContent } from "@/components/client/RichEditor"
import { Eye, Clock, User, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface QuestionPageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: QuestionPageProps) {
  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    select: { title: true },
  })
  if (!question) return { title: "Not found" }
  return { title: question.title }
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  const userRole = (session?.user as any)?.role

  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!question) notFound()

  await prisma.question.update({
    where: { id: question.id },
    data: { viewCount: { increment: 1 } },
  })

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

  const answerVotes = await Promise.all(
    answers.map(async (answer) => {
      const [up, down, userVote] = await Promise.all([
        prisma.vote.count({ where: { targetType: "answer", targetId: answer.id, value: 1 } }),
        prisma.vote.count({ where: { targetType: "answer", targetId: answer.id, value: -1 } }),
        userId
          ? prisma.vote.findUnique({
              where: { userId_targetType_targetId: { userId, targetType: "answer", targetId: answer.id } },
            })
          : null,
      ])
      return { answerId: answer.id, up, down, userVote: userVote?.value ?? null }
    })
  )

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
    where: { id: { not: question.id }, status: question.status },
    orderBy: { voteCount: "desc" },
    take: 5,
    select: { id: true, slug: true, title: true, answerCount: true, voteCount: true },
  })

  const highlightedContent = highlightHtmlContent(question.content)

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/questions" className="hover:text-foreground">Q&A</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate max-w-[200px]">{question.title}</span>
      </nav>

      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="mb-3 text-2xl font-bold">{question.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{question.author.name}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatRelativeTime(question.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{question.viewCount + 1} views</span>
            </div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link key={tag.slug} href={`/questions?tag=${tag.slug}`} className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80" style={{ backgroundColor: tag.color + "20", color: tag.color }}>
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="mb-4">
              <QuestionEditButton questionId={question.id} initialTitle={question.title} initialContent={question.content} userId={userId} />
            </div>
          )}

          <div className="mb-6">
            <RichContent html={highlightedContent} />
          </div>

          <div className="mb-8 flex items-center gap-3 border-b border-t py-4">
            <VoteButtons targetType="question" targetId={question.id} upVotes={qUpVotes} downVotes={qDownVotes} userVote={qUserVote?.value ?? null} />
            <BookmarkButton targetType="question" targetId={question.id} isBookmarked={isBookmarked} />
            <ShareButton title={question.title} />
          </div>

          <section>
            <h2 className="mb-4 text-lg font-semibold">{answers.length} answers</h2>
            <div className="space-y-4">
              {answers.map((answer) => {
                const votes = answerVotes.find((v) => v.answerId === answer.id)!
                return <AnswerItem key={answer.id} answer={answer} votes={votes} isAuthor={isAuthor} userId={userId} questionId={question.id} />
              })}
            </div>
            {answers.length === 0 && <p className="py-8 text-center text-muted-foreground">No answers yet</p>}
          </section>

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">Your Answer</h2>
            <AnswerForm questionId={question.id} userId={userId} />
          </section>
        </div>

        <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block">
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">Related</h3>
            {relatedQuestions.length > 0 ? (
              <ul className="space-y-2">
                {relatedQuestions.map((rq) => (
                  <li key={rq.id}>
                    <Link href={`/questions/${rq.slug}`} className="block text-xs text-muted-foreground hover:text-foreground line-clamp-2">{rq.title}</Link>
                    <span className="text-[10px] text-muted-foreground">{rq.answerCount} answers, {rq.voteCount} votes</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No related</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}