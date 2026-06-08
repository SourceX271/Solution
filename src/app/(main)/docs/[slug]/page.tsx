import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { highlightHtmlContent } from "@/lib/highlight"
import { auth } from "@/lib/auth"
import { VoteButtons } from "@/components/client/VoteButtons"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { CommentSection } from "@/components/client/CommentSection"
import { ChevronRight, Eye, Clock, User, Tag, AlertCircle, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

interface ArticlePageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true },
  })
  if (!article) return { title: "方案未找到" }
  return { title: article.title, description: article.excerpt ?? undefined }
}

const categoryLabels: Record<string, string> = {
  solution: "解决方案",
  tutorial: "教程",
  guide: "指南",
  reference: "参考",
  news: "资讯",
}

function extractHeadings(content: string) {
  const headings: { id: string; text: string; level: number }[] = []
  const regex = /<(h[1-4])[^>]*>(.*?)<\/h[1-4]>/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    const level = parseInt(match[1].replace("h", ""))
    const text = match[2].replace(/<[^>]*>/g, "").trim()
    const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "")
    headings.push({ id, text, level })
  }
  return headings
}

function addIdsToHeadings(content: string): string {
  return content.replace(/<(h[1-4])([^>]*)>(.*?)<\/h[1-4]>/gi, (_, tag, attrs, text) => {
    const plainText = text.replace(/<[^>]*>/g, "").trim()
    const id = plainText.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "")
    return "<" + tag + attrs + ' id="' + id + '">' + text + "</" + tag + ">"
  })
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const session = await auth()
  const userId = (session?.user as any)?.id

  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!article || article.status !== "published") notFound()

  await prisma.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  })

  const processedContent = addIdsToHeadings(highlightHtmlContent(article.content))
  const headings = extractHeadings(processedContent)
  const tags = article.tags

  const [upVotes, downVotes, userVote] = await Promise.all([
    prisma.vote.count({ where: { targetType: "article", targetId: article.id, value: 1 } }),
    prisma.vote.count({ where: { targetType: "article", targetId: article.id, value: -1 } }),
    userId
      ? prisma.vote.findUnique({
          where: { userId_targetType_targetId: { userId, targetType: "article", targetId: article.id } },
        })
      : null,
  ])

  const isBookmarked = userId
    ? !!(await prisma.bookmark.findUnique({
        where: { userId_targetType_targetId: { userId, targetType: "article", targetId: article.id } },
      }))
    : false

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">首页</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/docs" className="hover:text-foreground">解决方案</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate max-w-[200px]">{article.title}</span>
      </nav>

      <div className="flex gap-8">
        <aside className="sticky top-20 hidden w-56 shrink-0 self-start lg:block">
          <nav className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">目录</h3>
            {headings.length > 0 ? (
              <ul className="space-y-1">
                {headings.map((h) => (
                  <li key={h.id} style={{ paddingLeft: ((h.level - 1) * 12) + "px" }}>
                    <a href={"#" + h.id} className="block rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">{h.text}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">暂无目录</p>
            )}
          </nav>
        </aside>

        <article className="min-w-0 flex-1">
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {categoryLabels[article.category] ?? article.category}
              </span>
              {tags.map((tag) => (
                <span key={tag.slug} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Tag className="mr-1 inline h-3 w-3" />{tag.name}
                </span>
              ))}
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-tight">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{article.author.name}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatDate(article.createdAt)}（{formatRelativeTime(article.createdAt)}）</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{article.viewCount + 1} 阅读</span>
            </div>
          </header>

          {/* Problem statement */}
          {article.problem && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">遇到的问题</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400/80 leading-relaxed">{article.problem}</p>
                </div>
              </div>
            </div>
          )}

          {/* Solution content */}
          <div className="mb-8">
            {article.problem && (
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">解决方案</h2>
              </div>
            )}
            <div className="prose-custom max-w-none" dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>

          <div className="flex items-center gap-3 border-b border-t py-4">
            <VoteButtons targetType="article" targetId={article.id} upVotes={upVotes} downVotes={downVotes} userVote={userVote?.value ?? null} />
            <BookmarkButton targetType="article" targetId={article.id} isBookmarked={isBookmarked} />
            <ShareButton title={article.title} />
          </div>

          <section className="mt-8">
            <CommentSection targetType="article" targetId={article.id} userId={userId} />
          </section>
        </article>
      </div>
    </div>
  )
}