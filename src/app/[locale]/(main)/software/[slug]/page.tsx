import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { RatingWidget } from "@/components/client/RatingWidget"
import { CommentSection } from "@/components/client/CommentSection"
import { ReadingProgress } from "@/components/client/ReadingProgress"
import { BookmarkButton } from "@/components/client/BookmarkButton"
import { ShareButton } from "@/components/client/ShareButton"
import { SoftwareEditButton } from "@/components/client/SoftwareEditButton"
import { Star, ExternalLink, Clock, User, ChevronRight, Globe, Package } from "lucide-react"

export const revalidate = 3600;

interface SoftwarePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SoftwarePageProps) {
  const { slug } = await params
  const software = await prisma.software.findUnique({
    where: { slug },
    select: { name: true, description: true },
  })
  if (!software) return { title: "软件未找到" }
  return { title: software.name, description: software.description }
}

const CATEGORY_LABELS: Record<string, string> = {
  development: "开发",
  tool: "工具",
  website: "网站",
  game: "游戏",
  other: "其他",
}

export default async function SoftwarePage({ params }: SoftwarePageProps) {
  const { slug } = await params
  const session = await auth()
  const userId = (session?.user as any)?.id
  const userRole = (session?.user as any)?.role

  const software = await prisma.software.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!software || software.status !== "published") notFound()

  const tags = software.tags

  const userRating = userId
    ? await prisma.vote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType: "software", targetId: software.id } },
      })
    : null

  const isAuthor = userId === software.author.id
  const canEdit = isAuthor || userRole === "ADMIN"

  // Related software by category
  const relatedSoftware = await prisma.software.findMany({
    where: { status: "published", id: { not: software.id }, category: software.category },
    orderBy: { rating: "desc" },
    take: 5,
    select: { id: true, slug: true, name: true, rating: true },
  })

  return (
    <>
      <ReadingProgress />
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground animate-fade-in">
          <Link href="/" className="hover:text-foreground transition-colors">首页</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/software" className="hover:text-foreground transition-colors">软件</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{software.name}</span>
        </nav>

        <div className="flex gap-8 lg:gap-10">
          {/* Main */}
          <div className="min-w-0 flex-1 animate-fade-in-up">
            {/* Header */}
            <div className="mb-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Package className="h-3 w-3" />
                  {CATEGORY_LABELS[software.category] ?? software.category}
                </span>
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag.slug}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: tag.color + "15", color: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              <h1 className="mb-3 text-3xl font-bold tracking-tight gradient-text">{software.name}</h1>

              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">{software.author.name}</span>
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDate(software.createdAt)}
                </span>
                {software.url && (
                  <>
                    <span className="text-border">|</span>
                    <a
                      href={software.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      访问官网
                    </a>
                  </>
                )}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                  <span className="text-2xl font-bold tabular-nums">{software.rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  （{software.ratingCount} 人评分）
                </span>
              </div>

              <RatingWidget
                softwareId={software.id}
                currentRating={userRating?.value ?? 0}
                userId={userId}
              />
            </div>

            {/* Edit Button */}
            {canEdit && (
              <div className="mb-6 animate-fade-in-up stagger-1">
                <SoftwareEditButton
                  softwareId={software.id}
                  initialName={software.name}
                  initialDescription={software.description}
                  initialUrl={software.url || ""}
                  initialCategory={software.category}
                  userId={userId}
                />
              </div>
            )}

            {/* Description */}
            <div className="mb-8 animate-fade-in-up stagger-1">
              <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
                简介
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {software.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t pt-6 pb-4 animate-fade-in-up stagger-2">
              <BookmarkButton targetType="software" targetId={software.id} isBookmarked={false} />
              <ShareButton title={software.name} />
              {software.url && (
                <a
                  href={software.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium ml-auto"
                >
                  <Globe className="h-3.5 w-3.5" />
                  访问官网
                </a>
              )}
            </div>

            {/* Comments */}
            <section className="mt-8 animate-fade-in-up stagger-3">
              <CommentSection targetType="software" targetId={software.id} userId={userId} />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">软件信息</h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">分类</dt>
                  <dd className="font-medium">{CATEGORY_LABELS[software.category] ?? software.category}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">评分</dt>
                  <dd className="font-medium text-amber-600">{software.rating.toFixed(1)} / 5.0</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">评分数</dt>
                  <dd className="font-medium">{software.ratingCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">提交者</dt>
                  <dd className="font-medium">{software.author.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">更新于</dt>
                  <dd className="font-medium">{formatRelativeTime(software.updatedAt)}</dd>
                </div>
                {software.url && (
                  <div>
                    <dt className="text-muted-foreground mb-1">官网</dt>
                    <dd>
                      <a href={software.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{software.url}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {relatedSoftware.length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">相关软件</h3>
                <div className="space-y-2.5">
                  {relatedSoftware.map((rs) => (
                    <Link key={rs.id} href={`/software/${rs.slug}`} className="block text-xs text-muted-foreground hover:text-primary transition-colors">
                      <span className="line-clamp-1">{rs.name}</span>
                      <span className="text-[10px] flex items-center gap-1 mt-0.5">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                        {rs.rating.toFixed(1)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
