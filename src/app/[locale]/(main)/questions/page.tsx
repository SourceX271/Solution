import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatRelativeTime, cn } from "@/lib/utils";
import { PlusCircle, ChevronLeft, ChevronRight, MessageCircle, CheckCircle2, Clock } from "lucide-react";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "问答社区",
  description: "提出你的技术问题，获得专业解答。浏览待解决和已解决的问题。",
};

const STATUS_FILTERS = [
  { value: "", label: "全部", icon: MessageCircle },
  { value: "open", label: "待解决", icon: Clock },
  { value: "solved", label: "已解决", icon: CheckCircle2 },
];

const PAGE_SIZE = 15;

interface QuestionsPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const { page: pageStr, status } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const s = status ?? "";

  const where = s ? { status: s } : {};

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { select: { name: true, slug: true, color: true } }, author: { select: { name: true, image: true } } },
    }),
    prisma.question.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold gradient-text">问答社区</h1>
          <p className="mt-2 text-muted-foreground">共 {total} 个问题</p>
        </div>
        <Link
          href="/questions/ask"
          className="btn-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-lg shadow-primary/25"
        >
          <PlusCircle className="h-4 w-4" />
          提问
        </Link>
      </div>

      {/* Status Filters */}
      <div className="mb-6 flex gap-2 animate-fade-in-up stagger-1">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/questions${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "pill inline-flex items-center gap-1.5 transition-all",
              s === f.value ? "active shadow-md" : "hover:bg-primary/15"
            )}
          >
            <f.icon className="h-3.5 w-3.5" />
            {f.label}
          </Link>
        ))}
      </div>

      {/* Question List */}
      <div className="space-y-3">
        {questions.map((q, i) => {
          const tags = q.tags.slice(0, 4);
          return (
            <Link
              key={q.id}
              href={`/questions/${q.slug}`}
              className={cn(
                "glass-card flex gap-4 p-5 group",
                `animate-fade-in-up stagger-${Math.min(i + 1, 6)}`
              )}
            >
              {/* Stats */}
              <div className="flex shrink-0 gap-4">
                <div className="flex flex-col items-center min-w-[48px]">
                  <span className="text-lg font-bold text-foreground">{q.voteCount}</span>
                  <span className="text-[11px] text-muted-foreground">票</span>
                </div>
                <div className="flex flex-col items-center min-w-[48px]">
                  <span className={cn(
                    "text-lg font-bold",
                    q.status === "solved" ? "text-emerald-500" : "text-foreground"
                  )}>
                    {q.answerCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">回答</span>
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <h2 className="mb-1.5 font-semibold group-hover:text-primary transition-colors line-clamp-1 text-[15px]">
                  {q.title}
                </h2>
                <p className="mb-2.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {q.content.replace(/<[^>]*>/g, "").slice(0, 200)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {tags.map((tag) => (
                    <span
                      key={tag.slug}
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: tag.color + "15", color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  <span className="ml-auto flex items-center gap-1">
                    {q.author.name}
                    <span className="text-border">·</span>
                    {formatRelativeTime(q.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {questions.length === 0 && (
          <div className="py-20 text-center animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">暂无问题</p>
            <Link href="/questions/ask" className="btn-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
              <PlusCircle className="h-4 w-4" />提问
            </Link>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <Link
            href={`/questions?page=${page - 1}${s ? `&status=${s}` : ""}`}
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
            href={`/questions?page=${page + 1}${s ? `&status=${s}` : ""}`}
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
  );
}
