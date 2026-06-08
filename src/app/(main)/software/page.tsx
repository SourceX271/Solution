import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Star, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORIES = [
  { value: "", label: "全部" },
  { value: "development", label: "开发" },
  { value: "tool", label: "工具" },
  { value: "website", label: "网站" },
  { value: "game", label: "游戏" },
  { value: "other", label: "其他" },
]

const CATEGORY_LABELS: Record<string, string> = {
  development: "开发",
  tool: "工具",
  website: "网站",
  game: "游戏",
  other: "其他",
}

const PAGE_SIZE = 12

interface SoftwarePageProps {
  searchParams: { page?: string; category?: string }
}

export default async function SoftwarePage({ searchParams }: SoftwarePageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1)
  const category = searchParams.category ?? ""

  const where = {
    status: "published" as const,
    ...(category ? { category } : {}),
  }

  const [software, total] = await Promise.all([
    prisma.software.findMany({
      where,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true } } },
    }),
    prisma.software.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">软件推荐</h1>
        <p className="text-sm text-muted-foreground">共 {total} 款软件</p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={`/software${cat.value ? `?category=${cat.value}` : ""}`}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm transition-colors",
              category === cat.value
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            )}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Software Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {software.map((s) => (
          <Link
            key={s.id}
            href={`/software/${s.slug}`}
            className="glass-card flex flex-col p-5 transition hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {CATEGORY_LABELS[s.category] ?? s.category}
              </span>
              {s.rating > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {s.rating.toFixed(1)}
                </span>
              )}
            </div>
            <h2 className="mb-1 font-semibold hover:text-primary">{s.name}</h2>
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
              {s.description}
            </p>
            <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
              {s.url && (
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  访问
                </span>
              )}
              <span className="ml-auto">{s.author.name} · {formatDate(s.createdAt)}</span>
            </div>
          </Link>
        ))}

        {software.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            暂无软件
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link
            href={`/software?page=${page - 1}${category ? `&category=${category}` : ""}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm",
              page <= 1 && "pointer-events-none opacity-50"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Link>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Link
            href={`/software?page=${page + 1}${category ? `&category=${category}` : ""}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm",
              page >= totalPages && "pointer-events-none opacity-50"
            )}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}