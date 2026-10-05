import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getTranslations, getLocale } from "next-intl/server"
import { prisma } from "@/lib/db"
import { formatRelativeTime, cn } from "@/lib/utils"
import { Tag, BookOpen, MessageCircle, ExternalLink, ChevronRight, ArrowRight } from "lucide-react"

export const revalidate = 300

interface TagPageProps {
  params: Promise<{ slug: string }>
}

/** Cap on the items listed per type; the rest are reachable via "view all". */
const PREVIEW_SIZE = 12
/** How many co-tagged items are inspected when ranking related tags. */
const RELATED_SAMPLE = 100
const RELATED_LIMIT = 10

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const t = await getTranslations("tags")
  const { slug } = await params
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { name: true } })
  if (!tag) return { title: t("notFoundTitle") }
  return {
    title: t("metaTitle", { name: tag.name }),
    description: t("metaDescription", { name: tag.name }),
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const t = await getTranslations("tags")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const { slug } = await params
  const tag = await prisma.tag.findUnique({ where: { slug } })
  if (!tag) notFound()

  const articleWhere = { status: "published" as const, tags: { some: { slug } } }
  const questionWhere = { tags: { some: { slug } } }
  const softwareWhere = { status: "published" as const, tags: { some: { slug } } }

  const [
    articles,
    questions,
    software,
    articleTotal,
    questionTotal,
    softwareTotal,
    articleIds,
    questionIds,
    softwareIds,
  ] = await Promise.all([
    prisma.article.findMany({
      where: articleWhere,
      orderBy: { createdAt: "desc" },
      take: PREVIEW_SIZE,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.question.findMany({
      where: questionWhere,
      orderBy: { createdAt: "desc" },
      take: PREVIEW_SIZE,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.software.findMany({
      where: softwareWhere,
      orderBy: { createdAt: "desc" },
      take: PREVIEW_SIZE,
      include: {
        tags: { select: { name: true, slug: true, color: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.article.count({ where: articleWhere }),
    prisma.question.count({ where: questionWhere }),
    prisma.software.count({ where: softwareWhere }),
    // Ids feed the related-tag ranking below.
    prisma.article.findMany({ where: articleWhere, select: { id: true }, take: RELATED_SAMPLE }),
    prisma.question.findMany({ where: questionWhere, select: { id: true }, take: RELATED_SAMPLE }),
    prisma.software.findMany({ where: softwareWhere, select: { id: true }, take: RELATED_SAMPLE }),
  ])

  const aIds = articleIds.map((item) => item.id)
  const qIds = questionIds.map((item) => item.id)
  const sIds = softwareIds.map((item) => item.id)

  // Related tags = tags that appear on the same items, ranked by how many items
  // they share. Computed from the item ids so it needs no extra join table.
  const related =
    aIds.length + qIds.length + sIds.length === 0
      ? []
      : (
          await prisma.tag.findMany({
            where: {
              id: { not: tag.id },
              OR: [
                ...(aIds.length ? [{ articles: { some: { id: { in: aIds } } } }] : []),
                ...(qIds.length ? [{ questions: { some: { id: { in: qIds } } } }] : []),
                ...(sIds.length ? [{ software: { some: { id: { in: sIds } } } }] : []),
              ],
            },
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              articles: { where: { id: { in: aIds } }, select: { id: true } },
              questions: { where: { id: { in: qIds } }, select: { id: true } },
              software: { where: { id: { in: sIds } }, select: { id: true } },
            },
            take: 60,
          })
        )
          .map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            slug: candidate.slug,
            color: candidate.color,
            shared:
              candidate.articles.length + candidate.questions.length + candidate.software.length,
          }))
          .filter((candidate) => candidate.shared > 0)
          .sort((a, b) => b.shared - a.shared)
          .slice(0, RELATED_LIMIT)

  const sections = [
    {
      type: "article" as const,
      label: tc("solutions"),
      icon: BookOpen,
      items: articles,
      total: articleTotal,
      linkPrefix: "/solutions/",
      allHref: `/solutions?tag=${slug}`,
      nameKey: "title",
    },
    {
      type: "question" as const,
      label: tc("questions"),
      icon: MessageCircle,
      items: questions,
      total: questionTotal,
      linkPrefix: "/questions/",
      allHref: `/questions?tag=${slug}`,
      nameKey: "title",
    },
    {
      type: "software" as const,
      label: tc("software"),
      icon: ExternalLink,
      items: software,
      total: softwareTotal,
      linkPrefix: "/software/",
      allHref: `/software?tag=${slug}`,
      nameKey: "name",
    },
  ]

  const total = articleTotal + questionTotal + softwareTotal

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">{tc("home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{t("label")}</span>
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
          {t("title", { name: tag.name })}
        </h1>
        {tag.description && <p className="mt-2 text-muted-foreground">{tag.description}</p>}
        <p className="mt-1 text-sm text-muted-foreground">{t("totalCount", { total })}</p>
      </div>

      {total === 0 ? (
        <div className="py-16 text-center text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => {
            if (section.total === 0) return null
            return (
              <section key={section.type}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <section.icon className="h-5 w-5 text-primary" />
                  {section.label}
                  <span className="text-sm font-normal text-muted-foreground">({section.total})</span>
                  {section.total > section.items.length && (
                    <Link
                      href={section.allHref}
                      className="ml-auto inline-flex items-center gap-1 text-sm font-normal text-primary hover:underline"
                    >
                      {tc("viewMore")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
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
                        {item.author?.name} · {formatRelativeTime(item.createdAt, locale)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-4 text-lg font-semibold">{t("related")}</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/tags/${item.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform hover:scale-105"
                style={{ backgroundColor: item.color + "15", color: item.color }}
              >
                {item.name}
                <span className="opacity-60">{item.shared}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
