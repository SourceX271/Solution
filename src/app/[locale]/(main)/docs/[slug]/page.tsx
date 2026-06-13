import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { highlightHtmlContent } from "@/lib/highlight"
import { sanitizeHtml } from "@/lib/sanitize"
import { auth } from "@/lib/auth"
import { VoteButtons } from "@/components/client/VoteButtons"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { CommentSection } from "@/components/client/CommentSection"
import { ReadingProgress } from "@/components/client/ReadingProgress"
import { TableOfContents } from "@/components/client/TableOfContents"
import { CodeBlock } from "@/components/client/CodeBlock"
import { ArticleEditButton } from "@/components/client/ArticleEditButton"
import { ArticleJsonLd } from "@/components/JsonLd"
import { ChevronRight, Eye, Clock, User, Tag, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"

export const revalidate = 3600;

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = await prisma.article.findUnique({
    where: { slug },
    select: { title: true, excerpt: true },
  })
  if (!article) return { title: "方案未找到" }
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  }
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
  const regex = /<(h[2-4])[^>]*>(.*?)<\/h[2-4]>/gi
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
  return content.replace(/<(h[2-4])([^>]*)>(.*?)<\/h[2-4]>/gi, (_, tag, attrs, text) => {
    const plainText = text.replace(/<[^>]*>/g, "").trim()
    const id = plainText.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "")
    return `<${tag}${attrs} id="${id}">${text}</${tag}>`
  })
}

function injectCodeBlocks(html: string): string {
  return html.replace(
    /<pre><code class="hljs(?: language-([^"]*))?">([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
      const langAttr = lang ? ` data-lang="${lang}"` : ""
      return `<div class="code-block-wrapper"${langAttr} data-code="${escaped}"></div>`
    }
  )
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const session = await auth()
  const userId = (session?.user as any)?.id
  const userRole = (session?.user as any)?.role

  const article = await prisma.article.findUnique({
    where: { slug },
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

  const highlightedContent = await highlightHtmlContent(article.content)
  const processedContent = addIdsToHeadings(highlightedContent)
  const safeContent = await sanitizeHtml(processedContent)
  const headings = extractHeadings(safeContent)
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

  const isAuthor = userId === article.author.id
  const canEdit = isAuthor || userRole === "ADMIN"

  // Related solutions by tags
  const tagIds = article.tags.map(t => t.slug)
  const relatedArticles = tagIds.length > 0 ? await prisma.article.findMany({
    where: {
      status: "published",
      id: { not: article.id },
      tags: { some: { slug: { in: tagIds } } },
    },
    orderBy: { viewCount: "desc" },
    take: 5,
    select: { id: true, slug: true, title: true, viewCount: true, createdAt: true },
  }) : []

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3456"

  return (
    <>
      <ArticleJsonLd
        title={article.title}
        description={article.excerpt}
        authorName={article.author.name || "Unknown"}
        datePublished={article.createdAt.toISOString()}
        dateModified={article.updatedAt.toISOString()}
        url={`${siteUrl}/docs/${article.slug}`}
      />
      <ReadingProgress />
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground animate-fade-in">
          <Link href="/" className="hover:text-foreground transition-colors">首页</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/docs" className="hover:text-foreground transition-colors">解决方案</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground truncate max-w-[240px] font-medium">{article.title}</span>
        </nav>

        <div className="flex gap-8 lg:gap-10">
          {/* TOC Sidebar */}
          <aside className="sticky top-20 hidden w-56 shrink-0 self-start lg:block space-y-4">
            <TableOfContents headings={headings} title="目录" />

            {relatedArticles.length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">相关方案</h3>
                <div className="space-y-2">
                  {relatedArticles.map((ra) => (
                    <Link
                      key={ra.id}
                      href={`/docs/${ra.slug}`}
                      className="block text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-2"
                    >
                      {ra.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <article className="min-w-0 flex-1 animate-fade-in-up">
            <header className="mb-8">
              {/* Category & Tags */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {categoryLabels[article.category] ?? article.category}
                </span>
                {tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag.slug}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: tag.color + "15", color: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* Title */}
              <h1 className="mb-4 text-3xl font-bold tracking-tight gradient-text">{article.title}</h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">{article.author.name}</span>
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDate(article.createdAt)}
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {article.viewCount + 1} 阅读
                </span>
              </div>

              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3 rotate-45" />
                  查看原文
                </a>
              )}
            </header>

            {/* Edit Button */}
            {canEdit && (
              <div className="mb-6 animate-fade-in-up stagger-1">
                <ArticleEditButton
                  articleId={article.id}
                  initialTitle={article.title}
                  initialContent={article.content}
                  initialExcerpt={article.excerpt || ""}
                  initialProblem={article.problem || ""}
                  initialCategory={article.category}
                  userId={userId}
                />
              </div>
            )}

            {/* Problem Statement */}
            {article.problem && (
              <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-5 animate-fade-in-up stagger-1">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1.5">遇到的问题</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400/80 leading-relaxed">{article.problem}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Solution */}
            {article.problem && (
              <div className="flex items-center gap-2.5 mb-4 animate-fade-in-up stagger-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold">解决方案</h2>
              </div>
            )}

            {/* Content */}
            <div className="prose-custom max-w-none mb-10" dangerouslySetInnerHTML={{ __html: safeContent }} />

            {/* Actions */}
            <div className="flex items-center gap-3 border-t pt-6 pb-4 animate-fade-in-up">
              <VoteButtons targetType="article" targetId={article.id} upVotes={upVotes} downVotes={downVotes} userVote={userVote?.value ?? null} />
              <BookmarkButton targetType="article" targetId={article.id} isBookmarked={isBookmarked} />
              <ShareButton title={article.title} />
            </div>

            {/* Comments */}
            <section className="mt-8 animate-fade-in-up stagger-2">
              <CommentSection targetType="article" targetId={article.id} userId={userId} />
            </section>
          </article>
        </div>
      </div>
    </>
  )
}
