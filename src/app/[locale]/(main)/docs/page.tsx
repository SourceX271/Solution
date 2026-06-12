import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Eye, ChevronLeft, ChevronRight, Lightbulb, FileText, BookOpen, GraduationCap, Search } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORIES = [
  { value: "", label: "全部", icon: FileText },
  { value: "solution", label: "解决方案", icon: Lightbulb },
  { value: "tutorial", label: "教程", icon: GraduationCap },
  { value: "guide", label: "指南", icon: BookOpen },
  { value: "reference", label: "参考", icon: Search },
]

const PAGE_SIZE = 12

interface DocsPageProps {
  searchParams: Promise<{ page?: string; category?: string }>
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { page: pageStr, category } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const cat = category ?? ""

  const where = {
    status: "published" as const,
    ...(cat ? { category: cat } : {}),
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true, image: true } } },
    }),
    prisma.article.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold gradient-text">解决方案</h1>
        <p className="mt-2 text-muted-foreground">共 {total} 个方案</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-20">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">分类筛选</h3>
            <nav className="space-y-0.5">
              {CATEGORIES.map((c) => {
                const Icon = c.icon
                return (
                  <Link
                    key={c.value}
                    href={`/docs${c.value ? "?category=" + c.value : ""}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                      cat === c.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {c.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Mobile filter tabs */}
          <div className="mb-6 flex gap-1.5 lg:hidden flex-wrap">
            {CATEGORIES.slice(0, 4).map((c) => (
              <Link
                key={c.value}
                href={`/docs${c.value ? "?category=" + c.value : ""}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-all",
                  cat === c.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border bg-card hover:bg-accent"
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>

          {articles.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {articles.map((article, i) => (
                <Link
                  key={article.id}
                  href={`/docs/${article.slug}`}
                  className={cn("glass-card group flex flex-col p-5", `animate-fade-in-up stagger-${Math.min(i + 1, 6)}`)}
                >
                  {/* Category badge */}
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Lightbulb className="h-3 w-3" />
                      {CATEGORIES.find((c) => c.value === article.category)?.label ?? article.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="mb-2 font-semibold group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h2>

                  {/* Problem */}
                  {article.problem && (
                    <div className="mb-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-muted-foreground border-l-2 border-amber-400 line-clamp-2">
                      <span className="font-medium text-amber-700 dark:text-amber-400">问题：</span>
                      {article.problem}
                    </div>
                  )}

                  {/* Excerpt */}
                  {article.excerpt && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{article.author.name}</span>
                    <span className="text-border">·</span>
                    <span>{formatDate(article.createdAt)}</span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.viewCount}
                    </span>
                  </div>

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag.slug} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">暂无解决方案</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Link
                href={`/docs?page=${page - 1}${cat ? "&category=" + cat : ""}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all hover:bg-accent shadow-sm",
                  page <= 1 && "pointer-events-none opacity-40"
                )}
              >
                <ChevronLeft className="h-4 w-4" />上一页
              </Link>
              <span className="px-4 py-2 text-sm text-muted-foreground font-medium">
                {page} / {totalPages}
              </span>
              <Link
                href={`/docs?page=${page + 1}${cat ? "&category=" + cat : ""}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all hover:bg-accent shadow-sm",
                  page >= totalPages && "pointer-events-none opacity-40"
                )}
              >
                下一页<ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
