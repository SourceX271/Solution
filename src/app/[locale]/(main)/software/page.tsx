import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Star, ExternalLink, ChevronLeft, ChevronRight, Package, Globe, Wrench, Gamepad2, MoreHorizontal } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORIES = [
  { value: "", label: "全部", icon: Package },
  { value: "development", label: "开发", icon: Wrench },
  { value: "tool", label: "工具", icon: Wrench },
  { value: "website", label: "网站", icon: Globe },
  { value: "game", label: "游戏", icon: Gamepad2 },
  { value: "other", label: "其他", icon: MoreHorizontal },
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
  searchParams: Promise<{ page?: string; category?: string }>
}

export default async function SoftwarePage({ searchParams }: SoftwarePageProps) {
  const { page: pageStr, category } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const cat = category ?? ""

  const where = {
    status: "published" as const,
    ...(cat ? { category: cat } : {}),
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
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold gradient-text">软件推荐</h1>
        <p className="mt-2 text-muted-foreground">共 {total} 款软件</p>
      </div>

      {/* Category Filters */}
      <div className="mb-6 flex flex-wrap gap-2 animate-fade-in-up stagger-1">
        {CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/software${c.value ? `?category=${c.value}` : ""}`}
            className={cn(
              "pill inline-flex items-center gap-1.5 transition-all",
              cat === c.value ? "active shadow-md" : "hover:bg-primary/15"
            )}
          >
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </Link>
        ))}
      </div>

      {/* Software Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {software.map((s, i) => (
          <Link
            key={s.id}
            href={`/software/${s.slug}`}
            className={cn(
              "glass-card flex flex-col p-5 group",
              `animate-fade-in-up stagger-${Math.min(i + 1, 6)}`
            )}
          >
            {/* Header: Category + Rating */}
            <div className="mb-2.5 flex items-start justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Package className="h-3 w-3" />
                {CATEGORY_LABELS[s.category] ?? s.category}
              </span>
              {s.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {s.rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Name */}
            <h2 className="mb-1.5 font-semibold group-hover:text-primary transition-colors">
              {s.name}
            </h2>

            {/* Description */}
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {s.description}
            </p>

            {/* Footer */}
            <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
              {s.url && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <ExternalLink className="h-3 w-3" />访问
                </span>
              )}
              <span className="ml-auto">
                {s.author.name} · {formatDate(s.createdAt)}
              </span>
            </div>

            {/* Tags */}
            {s.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {s.tags.slice(0, 3).map((tag) => (
                  <span key={tag.slug} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}

        {software.length === 0 && (
          <div className="col-span-full py-20 text-center animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">暂无软件</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <Link
            href={`/software?page=${page - 1}${cat ? `&category=${cat}` : ""}`}
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
            href={`/software?page=${page + 1}${cat ? `&category=${cat}` : ""}`}
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
  )
}
