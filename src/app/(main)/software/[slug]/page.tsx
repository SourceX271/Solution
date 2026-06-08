import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { RatingWidget } from "@/components/client/RatingWidget"
import { CommentSection } from "@/components/client/CommentSection"
import { Star, ExternalLink, Clock, User, Tag, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface SoftwarePageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: SoftwarePageProps) {
  const software = await prisma.software.findUnique({
    where: { slug: params.slug },
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
  const session = await auth()
  const userId = (session?.user as any)?.id

  const software = await prisma.software.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      tags: { select: { name: true, slug: true, color: true } },
      _count: { select: { comments: true } },
    },
  })

  if (!software || software.status !== "published") notFound()

  const tags = software.tags

  // Get user's rating
  const userRating = userId
    ? await prisma.vote.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: "software",
            targetId: software.id,
          },
        },
      })
    : null

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">首页</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/software" className="hover:text-foreground">软件</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{software.name}</span>
      </nav>

      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {CATEGORY_LABELS[software.category] ?? software.category}
              </span>
              {tags.map((tag) => (
                <span
                  key={tag.slug}
                  className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <Tag className="mr-1 inline h-3 w-3" />
                  {tag.name}
                </span>
              ))}
            </div>
            <h1 className="mb-3 text-3xl font-bold">{software.name}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="h-4 w-4" />
                {software.author.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(software.createdAt)}
              </span>
              {software.url && (
                <a
                  href={software.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  访问官网
                </a>
              )}
            </div>
            {/* Rating */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <span className="text-lg font-bold">{software.rating.toFixed(1)}</span>
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

          {/* Description */}
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">简介</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {software.description}
            </p>
          </div>

          {/* Comments */}
          <section>
            <CommentSection
              targetType="software"
              targetId={software.id}
              userId={userId}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="sticky top-20 hidden w-60 shrink-0 self-start lg:block">
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">软件信息</h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">分类</dt>
                <dd>{CATEGORY_LABELS[software.category] ?? software.category}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">评分</dt>
                <dd>{software.rating.toFixed(1)} / 5.0</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">评分数</dt>
                <dd>{software.ratingCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">提交者</dt>
                <dd>{software.author.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>{formatRelativeTime(software.updatedAt)}</dd>
              </div>
              {software.url && (
                <div>
                  <dt className="text-muted-foreground">官网</dt>
                  <dd>
                    <a
                      href={software.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {software.url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
