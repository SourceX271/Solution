import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { formatRelativeTime, cn } from "@/lib/utils";
import {
  BookOpen, MessageCircle, ExternalLink, Search, Tag,
  TrendingUp, ArrowRight, Sparkles, Users, FileText, HelpCircle, Package,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ type?: string; tag?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const { type: filterType, tag: filterTag } = await searchParams;
  const ft = filterType || "";
  const fTag = filterTag || "";

  const [articles, questions, software, tags, siteConfig] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "published",
        ...(fTag ? { tags: { some: { slug: fTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: ft && ft !== "article" ? 0 : 8,
      include: {
        author: { select: { name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    }),
    prisma.question.findMany({
      where: {
        ...(fTag ? { tags: { some: { slug: fTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: ft && ft !== "question" ? 0 : 8,
      include: {
        author: { select: { name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    }),
    prisma.software.findMany({
      where: {
        status: "published",
        ...(fTag ? { tags: { some: { slug: fTag } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: ft && ft !== "software" ? 0 : 8,
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
    ...articles.map((a) => ({ ...a, contentType: "article" as const })),
    ...questions.map((q) => ({ ...q, contentType: "question" as const })),
    ...software.map((s) => ({ ...s, contentType: "software" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    articles: await prisma.article.count({ where: { status: "published" } }),
    questions: await prisma.question.count(),
    software: await prisma.software.count({ where: { status: "published" } }),
    users: await prisma.user.count(),
  };

  const typeIcons = { article: BookOpen, question: MessageCircle, software: ExternalLink };
  const typeLabels: Record<string, string> = { article: t("typeSolution"), question: t("typeQuestion"), software: t("typeSoftware") };
  const iconColors: Record<string, string> = {
    article: "from-blue-500 to-cyan-500",
    question: "from-amber-500 to-orange-500",
    software: "from-emerald-500 to-teal-500",
  };
  const badgeColors: Record<string, string> = {
    article: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    question: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    software: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };

  const statItems = [
    { label: t("statsSolutions"), value: stats.articles, icon: FileText, color: "text-blue-500", gradient: "from-blue-500/10 to-blue-500/5" },
    { label: t("statsQuestions"), value: stats.questions, icon: HelpCircle, color: "text-amber-500", gradient: "from-amber-500/10 to-amber-500/5" },
    { label: t("statsSoftware"), value: stats.software, icon: Package, color: "text-emerald-500", gradient: "from-emerald-500/10 to-emerald-500/5" },
    { label: t("statsUsers"), value: stats.users, icon: Users, color: "text-violet-500", gradient: "from-violet-500/10 to-violet-500/5" },
  ];

  const buildUrl = (type?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (type) params.set("type", type);
    const qs = params.toString();
    return "/" + (qs ? "?" + qs : "");
  };

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden hero-gradient">
        <div className="absolute inset-0 animated-dots opacity-30" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-gradient-to-tl from-violet-500/10 to-fuchsia-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

        <div className="container mx-auto px-4 py-20 md:py-28 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6 animate-fade-in-up shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {siteConfig?.siteDescription || ""}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up stagger-1">
            <span className="gradient-text">{siteConfig?.siteName || "Solution"}</span>
            <br />
            <span className="text-2xl md:text-3xl lg:text-4xl text-foreground/80 font-semibold">
              {t("heroSubtitle")}
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-muted-foreground animate-fade-in-up stagger-2">
            {t("heroSubtitle")}
          </p>

          {/* Search */}
          <form action="/search" className="mx-auto flex max-w-lg gap-2 animate-fade-in-up stagger-3">
            <div className="relative flex-1 group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within/search:text-primary z-10" />
              <input
                name="q"
                placeholder={t("searchPlaceholder") || "搜索..."}
                className="w-full h-12 rounded-full border-2 border-muted-foreground/10 bg-card pl-12 pr-4 text-sm shadow-lg transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 focus:outline-none hover:shadow-xl"
              />
            </div>
            <button
              type="submit"
              className="btn-gradient h-12 px-8 rounded-full text-sm font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              {tc("search")}
            </button>
          </form>

          {/* Quick Links */}
          <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-in-up stagger-4">
            <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />{t("typeSolution")}
            </Link>
            <Link href="/questions" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
              <MessageCircle className="h-3.5 w-3.5 text-amber-500" />{t("typeQuestion")}
            </Link>
            <Link href="/software" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
              <ExternalLink className="h-3.5 w-3.5 text-emerald-500" />{t("typeSoftware")}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statItems.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "stat-card text-center animate-fade-in-up",
                  `stagger-${i + 1}`
                )}
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} mb-3`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Content Feed ─── */}
      <section className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Filter Tabs */}
            <div className="mb-6 flex flex-wrap items-center gap-2 animate-fade-in-up">
              <Link
                href={buildUrl()}
                className={cn(
                  "pill transition-all",
                  !ft ? "active shadow-md" : "hover:bg-primary/15"
                )}
              >
                {t("filterAll")}
              </Link>
              {(["article", "question", "software"] as const).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <Link
                    key={type}
                    href={buildUrl(type, fTag)}
                    className={cn(
                      "pill inline-flex items-center gap-1.5 transition-all",
                      ft === type ? "active shadow-md" : "hover:bg-primary/15"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {typeLabels[type]}
                  </Link>
                );
              })}
            </div>

            {/* Items List */}
            {allItems.length === 0 ? (
              <div className="py-20 text-center animate-fade-in">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{tc("noData")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allItems.map((item, i) => {
                  const Icon = typeIcons[item.contentType];
                  const linkHref =
                    item.contentType === "article"
                      ? "/docs/" + item.slug
                      : item.contentType === "question"
                        ? "/questions/" + item.slug
                        : "/software/" + item.slug;

                  return (
                    <Link
                      key={item.id + item.contentType}
                      href={linkHref}
                      className={cn(
                        "glass-card flex gap-4 p-5 group animate-fade-in-up",
                        `stagger-${Math.min(i + 1, 8)}`
                      )}
                    >
                      {/* Icon */}
                      <div className="hidden sm:flex shrink-0">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm group-hover:scale-110 transition-transform",
                          iconColors[item.contentType]
                        )}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium",
                            badgeColors[item.contentType]
                          )}>
                            {typeLabels[item.contentType]}
                          </span>
                          {item.contentType === "article" && item.category && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {item.category}
                            </span>
                          )}
                        </div>

                        <h2 className="mb-1 font-semibold group-hover:text-primary transition-colors line-clamp-1">
                          {item.contentType === "software" ? item.name : item.title}
                        </h2>

                        <p className="mb-2.5 text-sm text-muted-foreground line-clamp-2">
                          {item.contentType === "software"
                            ? item.description
                            : item.contentType === "article"
                              ? ((item as any).excerpt || (item as any).content || "").replace(/<[^>]*>/g, "").slice(0, 200)
                              : ((item as any).content || "").replace(/<[^>]*>/g, "").slice(0, 200)}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {"tags" in item && Array.isArray(item.tags) && item.tags.slice(0, 3).map((tag: any) => (
                            <span
                              key={tag.slug}
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ backgroundColor: tag.color + "15", color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          <span className="ml-auto flex items-center gap-1">
                            {item.author?.name && (
                              <>
                                <span>{item.author.name}</span>
                                <span className="text-border">·</span>
                              </>
                            )}
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {allItems.length > 0 && (
              <div className="mt-8 text-center animate-fade-in-up">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium hover:bg-accent transition-all shadow-sm hover:shadow-md"
                >
                  {tc("viewMore")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar Tags */}
          <aside className="w-full lg:w-64 lg:shrink-0">
            <div className="glass-card sticky top-24 rounded-xl p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4 text-primary" />
                {t("hotTags")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 15).map((tag) => (
                  <Link
                    key={tag.slug}
                    href={buildUrl(ft, tag.slug)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all hover:scale-105",
                      fTag === tag.slug
                        ? "text-white shadow-md"
                        : "hover:opacity-90"
                    )}
                    style={{
                      backgroundColor: fTag === tag.slug ? tag.color : tag.color + "15",
                      color: fTag === tag.slug ? "#fff" : tag.color,
                    }}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-60">{tag.usageCount}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
