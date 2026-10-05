import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Headline numbers plus the 30-day deltas the dashboard shows.
 * `Math.random()` used to stand in for the growth figure in the UI — every
 * number here is computed from the database.
 */
export async function GET() {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY);
    const previous30 = new Date(now.getTime() - 60 * DAY);

    const [
      users,
      articles,
      questions,
      software,
      answers,
      comments,
      pendingContent,
      pendingSoftware,
      openQuestions,
      bannedUsers,
      failedCrawls,
      newUsers30,
      newUsersPrev30,
      newArticles30,
      newArticlesPrev30,
      views,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.article.count(),
      prisma.question.count(),
      prisma.software.count(),
      prisma.answer.count(),
      prisma.comment.count(),
      prisma.article.count({ where: { status: "draft" } }),
      prisma.software.count({ where: { status: "pending" } }),
      prisma.question.count({ where: { status: "open", answerCount: 0 } }),
      prisma.user.count({ where: { bannedAt: { not: null } } }),
      prisma.crawlLog.count({ where: { status: "error", createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.user.count({ where: { createdAt: { gte: previous30, lt: since30 } } }),
      prisma.article.count({ where: { createdAt: { gte: since30 } } }),
      prisma.article.count({ where: { createdAt: { gte: previous30, lt: since30 } } }),
      prisma.article.aggregate({ _sum: { viewCount: true } }),
    ]);

    const delta = (current: number, previous: number) =>
      previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);

    return NextResponse.json({
      users,
      articles,
      questions,
      software,
      answers,
      comments,
      views: views._sum.viewCount ?? 0,
      pending: {
        drafts: pendingContent + pendingSoftware,
        unansweredQuestions: openQuestions,
        failedCrawls,
        bannedUsers,
      },
      growth: {
        users: delta(newUsers30, newUsersPrev30),
        articles: delta(newArticles30, newArticlesPrev30),
        newUsers30,
        newArticles30,
      },
      generatedAt: startOfDay(now).toISOString(),
    });
  } catch (error) {
    console.error("Admin stats failed", error);
    return NextResponse.json({ error: t("getFailed", { entity: t("entity.stats") }) }, { status: 500 });
  }
}
