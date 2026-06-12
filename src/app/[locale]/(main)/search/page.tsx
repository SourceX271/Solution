import Link from "next/link"
import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { formatDate, cn } from "@/lib/utils"
import { Search, FileText, MessageCircle, Package, ArrowRight } from "lucide-react"

export const revalidate = 60;

export const metadata: Metadata = {
  title: "搜索",
  description: "搜索解决方案、问答和软件推荐。",
};

const TYPE_FILTERS = [
  { value: "", label: "全部", icon: Search },
  { value: "article", label: "文章", icon: FileText },
  { value: "question", label: "问答", icon: MessageCircle },
  { value: "software", label: "软件", icon: Package },
]

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, type: filterType } = await searchParams
  const query = (q ?? "").trim()

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6">
          <Search className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold gradient-text">搜索</h1>
        <p className="text-muted-foreground mb-6">请输入关键词搜索文章、问答和软件</p>
        <form action="/search" className="mx-auto flex max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              name="q"
              placeholder="搜索..."
              className="w-full rounded-xl border bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm"
            />
          </div>
          <button type="submit" className="btn-gradient rounded-xl px-6 py-2.5 text-sm font-medium">
            搜索
          </button>
        </form>
      </div>
    )
  }

  const [articles, questions, software] = await Promise.all([
    filterType && filterType !== "article" ? [] : prisma.article.findMany({
      where: {
        status: "published",
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
          { excerpt: { contains: query } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true } } },
    }),
    filterType && filterType !== "question" ? [] : prisma.question.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true } } },
    }),
    filterType && filterType !== "software" ? [] : prisma.software.findMany({
      where: {
        status: "published",
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
        ],
      },
      take: 10,
      orderBy: { rating: "desc" },
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true } } },
    }),
  ])

  const totalResults = articles.length + questions.length + software.length

  const sections = [
    { type: "article", label: "文章", icon: FileText, gradient: "from-blue-500 to-cyan-500", items: articles, toLabel: "title", linkPrefix: "/docs/" },
    { type: "question", label: "问答", icon: MessageCircle, gradient: "from-amber-500 to-orange-500", items: questions, toLabel: "title", linkPrefix: "/questions/" },
    { type: "software", label: "软件", icon: Package, gradient: "from-emerald-500 to-teal-500", items: software, toLabel: "name", linkPrefix: "/software/" },
  ]

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text mb-1">搜索结果</h1>
        <p className="text-muted-foreground">
          关于 &ldquo;<span className="font-medium text-foreground">{query}</span>&rdquo; 的搜索结果，共 <span className="font-semibold text-primary">{totalResults}</span> 条
        </p>
      </div>

      {/* Type filter tabs */}
      {query && (
        <div className="mb-6 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => {
            const active = filterType === f.value || (!filterType && f.value === "")
            const Icon = f.icon
            return (
              <Link
                key={f.value}
                href={`/search?q=${encodeURIComponent(query)}${f.value ? `&type=${f.value}` : ""}`}
                className={cn(
                  "pill inline-flex items-center gap-1.5 transition-all",
                  active ? "active shadow-md" : "hover:bg-primary/15"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </Link>
            )
          })}
        </div>
      )}

      {totalResults === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg mb-2">未找到相关内容</p>
          <p className="text-sm text-muted-foreground">请尝试其他关键词</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => {
            if (section.items.length === 0) return null
            return (
              <section key={section.type}>
                <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
                  <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${section.gradient} shadow-sm`}>
                    <section.icon className="h-4 w-4 text-white" />
                  </div>
                  {section.label}
                  <span className="text-sm font-normal text-muted-foreground">({section.items.length})</span>
                </h2>
                <div className="space-y-2">
                  {section.items.map((item: any) => (
                    <Link
                      key={item.id}
                      href={`${section.linkPrefix}${item.slug}`}
                      className="glass-card flex items-center gap-3 p-4 group"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                          {item[section.toLabel]}
                        </h3>
                        {section.type === "article" && item.excerpt && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.excerpt}</p>
                        )}
                        {section.type === "software" && item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.author.name} · {formatDate(item.createdAt)}
                          {section.type === "question" && <> · {item.answerCount} 回答</>}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
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
