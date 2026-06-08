import Link from "next/link"
import { prisma } from "@/lib/db"
import { formatDate } from "@/lib/utils"
import { Search, FileText, MessageCircle, Wrench } from "lucide-react"

export const dynamic = "force-dynamic"

interface SearchPageProps {
  searchParams: { q?: string }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams.q ?? "").trim()

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">搜索</h1>
        <p className="text-muted-foreground">请输入关键词搜索文章、问答和软件</p>
      </div>
    )
  }

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({
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
    prisma.question.findMany({
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
    prisma.software.findMany({
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">搜索结果</h1>
        <p className="text-sm text-muted-foreground">
          关于 &ldquo;{query}&rdquo; 的搜索结果，共 {totalResults} 条
        </p>
      </div>

      {totalResults === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>未找到相关内容，请尝试其他关键词</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Articles */}
          {articles.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5 text-blue-500" />
                文章 ({articles.length})
              </h2>
              <div className="space-y-3">
                {articles.map((a) => (
                  <Link
                    key={a.id}
                    href={`/docs/${a.slug}`}
                    className="glass-card block p-4 transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        文章
                      </span>
                      <h3 className="font-medium hover:text-primary">{a.title}</h3>
                    </div>
                    {a.excerpt && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{a.excerpt}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.author.name} · {formatDate(a.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <MessageCircle className="h-5 w-5 text-green-500" />
                问答 ({questions.length})
              </h2>
              <div className="space-y-3">
                {questions.map((q) => (
                  <Link
                    key={q.id}
                    href={`/questions/${q.slug}`}
                    className="glass-card block p-4 transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        问答
                      </span>
                      <h3 className="font-medium hover:text-primary">{q.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.author.name} · {q.answerCount} 回答 · {formatDate(q.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Software */}
          {software.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Wrench className="h-5 w-5 text-purple-500" />
                软件 ({software.length})
              </h2>
              <div className="space-y-3">
                {software.map((s) => (
                  <Link
                    key={s.id}
                    href={`/software/${s.slug}`}
                    className="glass-card block p-4 transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        软件
                      </span>
                      <h3 className="font-medium hover:text-primary">{s.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{s.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.author.name} · {formatDate(s.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}