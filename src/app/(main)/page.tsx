import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRelativeTime, cn } from "@/lib/utils";
import { BookOpen, MessageCircle, ExternalLink, Search, Tag, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { type?: string; tag?: string };
}) {
  const filterType = searchParams.type || "";
  const filterTag = searchParams.tag || "";

  const [articles, questions, software, tags, siteConfig] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "published",
        ...(filterTag ? { tags: { some: { slug: filterTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filterType && filterType !== "article" ? 0 : 8,
      include: {
        author: { select: { name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    }),
    prisma.question.findMany({
      where: {
        ...(filterTag ? { tags: { some: { slug: filterTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filterType && filterType !== "question" ? 0 : 8,
      include: {
        author: { select: { name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    }),
    prisma.software.findMany({
      where: {
        status: "published",
        ...(filterTag ? { tags: { some: { slug: filterTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filterType && filterType !== "software" ? 0 : 8,
      include: {
        author: { select: { name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    }),
    prisma.tag.findMany({
      orderBy: { usageCount: "desc" },
      take: 20,
    }),
    prisma.siteConfig.findUnique({ where: { id: "main" } }),
  ]);

  const allItems = [
    ...articles.map((a) => ({ ...a, contentType: "article" })),
    ...questions.map((q) => ({ ...q, contentType: "question" })),
    ...software.map((s) => ({ ...s, contentType: "software" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    articles: await prisma.article.count({ where: { status: "published" } }),
    questions: await prisma.question.count(),
    software: await prisma.software.count({ where: { status: "published" } }),
    users: await prisma.user.count(),
  };

  const typeIcons = { article: BookOpen, question: MessageCircle, software: ExternalLink };
  const typeLabels = { article: "文档", question: "问答", software: "软件" };
  const typeColors = {
    article: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    question: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    software: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  const buildTypeUrl = (type: string) => {
    const params = new URLSearchParams();
    if (filterTag) params.set("tag", filterTag);
    if (type) params.set("type", type);
    const qs = params.toString();
    return "/" + (qs ? "?" + qs : "");
  };

  const buildTagUrl = (slug: string) => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    params.set("tag", slug);
    return "/?" + params.toString();
  };

  const clearTagUrl = () => {
    if (filterType) return "/?type=" + filterType;
    return "/";
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">{siteConfig?.siteName || "Solution"}</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            {siteConfig?.siteDescription || "社区技术文档与问答平台"}
          </p>
          <form action="/search" className="mx-auto flex max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" placeholder="搜索文档、问答、软件..." className="w-full rounded-full border bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">搜索</button>
          </form>
        </div>
      </div>

      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "文档", value: stats.articles },
              { label: "问答", value: stats.questions },
              { label: "软件", value: stats.software },
              { label: "用户", value: stats.users },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Link href={clearTagUrl()} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors",!filterType ? "bg-primary text-primary-foreground" : "border hover:bg-accent")}>全部</Link>
              {(["article", "question", "software"] as const).map((t) => {
                const Icon = typeIcons[t];
                return (
                  <Link key={t} href={buildTypeUrl(t)} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",filterType === t ? "bg-primary text-primary-foreground" : "border hover:bg-accent")}>
                    <Icon className="h-3.5 w-3.5" />{typeLabels[t]}
                  </Link>
                );
              })}
            </div>

            <div className="space-y-4">
              {allItems.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground"><p>暂无内容</p></div>
              ) : (
                allItems.map((item: any) => {
                  const Icon = typeIcons[item.contentType as keyof typeof typeIcons];
                  const linkHref = item.contentType === "article" ? "/docs/" + item.slug : item.contentType === "question" ? "/questions/" + item.slug : "/software/" + item.slug;

                  return (
                    <Link key={item.id + item.contentType} href={linkHref} className="glass-card flex gap-4 p-5 transition hover:shadow-md">
                      <div className="hidden sm:block">
                        <span className={cn("inline-flex rounded-lg px-2 py-1.5", typeColors[item.contentType as keyof typeof typeColors])}>
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", typeColors[item.contentType as keyof typeof typeColors])}>{typeLabels[item.contentType as keyof typeof typeLabels]}</span>
                        </div>
                        <h2 className="mb-1 font-semibold hover:text-primary">{item.contentType === "software" ? (item as any).name : (item as any).title}</h2>
                        <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
                          {item.contentType === "software" ? (item as any).description : ((item as any).excerpt || item.content || "").replace(/<[^>]*>/g, "").slice(0, 200)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {"tags" in item && Array.isArray((item as any).tags) && (item as any).tags.slice(0, 3).map((tag: any) => (
                            <span key={tag.slug} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: tag.color + "20", color: tag.color }}>{tag.name}</span>
                          ))}
                          <span className="ml-auto">{(item as any).author?.name} · {formatRelativeTime(item.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="w-full lg:w-64 lg:shrink-0">
            <div className="glass-card sticky top-24 rounded-xl p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Tag className="h-4 w-4" />热门标签</h3>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 15).map((tag: any) => (
                  <Link key={tag.slug} href={buildTagUrl(tag.slug)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", filterTag === tag.slug ? "text-white" : "hover:opacity-80")}
                    style={{backgroundColor: filterTag === tag.slug ? tag.color : tag.color + "15", color: filterTag === tag.slug ? "#fff" : tag.color}}>
                    {tag.name}<span className="ml-1 opacity-60">{tag.usageCount}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
