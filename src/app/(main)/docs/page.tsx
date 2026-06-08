import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Eye, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORIES = [
  { value: "", label: "全部" },
  { value: "solution", label: "解决方案" },
  { value: "tutorial", label: "教程" },
  { value: "guide", label: "指南" },
  { value: "reference", label: "参考" },
]

const PAGE_SIZE = 12

interface DocsPageProps {
  searchParams: { page?: string; category?: string }
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1)
  const category = searchParams.category ?? ""

  const where = {
    status: "published" as const,
    ...(category ? { category } : {}),
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-20">
            <h3 className="mb-3 text-sm font-semibold">分类筛选</h3>
            <nav className="space-y-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.value}
                  href={`/docs${cat.value ? "?category=" + cat.value : ""}`}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors",
                    category === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">解决方案</h1>
              <p className="text-sm text-muted-foreground">共 {total} 个方案</p>
            </div>
            <div className="flex gap-1 lg:hidden">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.value}
                  href={`/docs${cat.value ? "?category=" + cat.value : ""}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    category === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  )}
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>

          {articles.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/docs/${article.slug}`}
                  className="glass-card group flex flex-col p-5 transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {article.category === "solution" && <Lightbulb className="h-3 w-3" />}
                      {CATEGORIES.find((c) => c.value === article.category)?.label ?? article.category}
                    </span>
                  </div>
                  <h2 className="mb-2 font-semibold group-hover:text-primary line-clamp-2">
                    {article.title}
                  </h2>
                  {article.problem && (
                    <p className="mb-2 rounded bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-xs text-muted-foreground line-clamp-2 border-l-2 border-amber-400">
                      问题：{article.problem}
                    </p>
                  )}
                  {article.excerpt && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.author.name}</span>
                    <span>·</span>
                    <span>{formatDate(article.createdAt)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.viewCount}
                    </span>
                  </div>
                  {article.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag.slug} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">暂无解决方案</div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Link
                href={`/docs?page=${page - 1}${category ? "&category=" + category : ""}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm",
                  page <= 1 && "pointer-events-none opacity-50"
                )}
              >
                <ChevronLeft className="h-4 w-4" />上一页
              </Link>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Link
                href={`/docs?page=${page + 1}${category ? "&category=" + category : ""}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm",
                  page >= totalPages && "pointer-events-none opacity-50"
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