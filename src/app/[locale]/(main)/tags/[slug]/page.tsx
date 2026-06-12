import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { formatRelativeTime, cn } from "@/lib/utils"
import { Tag, BookOpen, MessageCircle, ExternalLink, ChevronRight } from "lucide-react"

export const revalidate = 300

interface TagPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { name: true } })
  if (!tag) return { title: "标签未找到" }
  return {
    title: `标签: ${tag.name}`,
    description: `浏览所有与 ${tag.name} 相关的内容`,
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params
  const tag = await prisma.tag.findUnique({ where: { slug } })
  if (!tag) notFound()

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published", tags: { some: { slug } } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.question.findMany({
      where: { tags: { some: { slug } } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.software.findMany({
      where: { status: "published", tags: { some: { slug } } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
  ])

  const sections = [
    { type: "article" as const, label: "解决方案", icon: BookOpen, items: articles, linkPrefix: "/docs/", nameKey: "title" },
    { type: "question" as const, label: "问答", icon: MessageCircle, items: questions, linkPrefix: "/questions/", nameKey: "title" },
    { type: "software" as const, label: "软件", icon: ExternalLink, items: software, linkPrefix: "/software/", nameKey: "name" },
  ]

  const total = articles.length + questions.length + software.length

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">首页</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">标签</span>
        <ChevronRight className="h-3 w-3" />
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tag.color + "20", color: tag.color }}>
          {tag.name}
        </span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: tag.color + "15" }}>
            <Tag className="h-5 w-5" style={{ color: tag.color }} />
          </span>
          标签: {tag.name}
        </h1>
        {tag.description && <p className="mt-2 text-muted-foreground">{tag.description}</p>}
        <p className="mt-1 text-sm text-muted-foreground">共 {total} 条相关内容</p>
      </div>

      {total === 0 ? (
        <div className="py-16 text-center text-muted-foreground">该标签下暂无内容</div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => {
            if (section.items.length === 0) return null
            return (
              <section key={section.type}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <section.icon className="h-5 w-5 text-primary" />
                  {section.label}
                  <span className="text-sm font-normal text-muted-foreground">({section.items.length})</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item: any, i: number) => (
                    <Link
                      key={item.id}
                      href={`${section.linkPrefix}${item.slug}`}
                      className={cn("glass-card p-4 group", i < 6 && `animate-fade-in-up stagger-${i + 1}`)}
                    >
                      <h3 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                        {item[section.nameKey]}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.author?.name} · {formatRelativeTime(item.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
