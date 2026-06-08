import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRelativeTime, cn } from "@/lib/utils";
import { PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: "", label: "全部" },
  { value: "open", label: "待解决" },
  { value: "solved", label: "已解决" },
];

const PAGE_SIZE = 15;

interface QuestionsPageProps {
  searchParams: { page?: string; status?: string };
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1);
  const status = searchParams.status ?? "";

  const where = status ? { status } : {};

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">问答社区</h1>
          <p className="text-sm text-muted-foreground">共 {total} 个问题</p>
        </div>
        <Link
          href="/questions/ask"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <PlusCircle className="h-4 w-4" />
          提问
        </Link>
      </div>

      <div className="mb-6 flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/questions${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm transition-colors",
              status === f.value
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {questions.map((q) => {
          const tags = q.tags.slice(0, 4);
          return (
            <Link
              key={q.id}
              href={`/questions/${q.slug}`}
              className="glass-card flex gap-4 p-5 transition hover:shadow-md"
            >
              <div className="flex shrink-0 gap-4 text-sm text-muted-foreground">
                <div className="flex flex-col items-center">
                  <span className="font-semibold text-foreground">{q.voteCount}</span>
                  <span>票</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "font-semibold",
                    q.status === "solved" ? "text-green-600" : "text-foreground"
                  )}>
                    {q.answerCount}
                  </span>
                  <span>回答</span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="mb-1 font-semibold hover:text-primary line-clamp-1">
                  {q.title}
                </h2>
                <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
                  {q.content.replace(/<[^>]*>/g, "").slice(0, 200)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {tags.map((tag) => (
                    <span key={tag.slug} className="rounded bg-muted px-1.5 py-0.5">
                      {tag.name}
                    </span>
                  ))}
                  <span className="ml-auto">
                    {q.author.name} · {formatRelativeTime(q.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {questions.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">暂无问题</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link
            href={`/questions?page=${page - 1}${status ? `&status=${status}` : ""}`}
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
            href={`/questions?page=${page + 1}${status ? `&status=${status}` : ""}`}
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
  );
}
