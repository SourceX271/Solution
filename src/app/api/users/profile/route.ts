import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse } from "@/lib/errors";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ auth: "required" }, async (req, ctx) => {
  const userId = ctx.session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user) {
    return successResponse(null);
  }

  const [articleCount, questionCount, answerCount, softwareCount, bookmarks, articles, questions, software] =
    await Promise.all([
      prisma.article.count({ where: { authorId: userId } }),
      prisma.question.count({ where: { authorId: userId } }),
      prisma.answer.count({ where: { authorId: userId } }),
      prisma.software.count({ where: { authorId: userId } }),
      prisma.bookmark.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.article.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, slug: true, createdAt: true },
      }),
      prisma.question.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, slug: true, createdAt: true },
      }),
      prisma.software.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { name: true, slug: true, createdAt: true },
      }),
    ]);

  // Resolve bookmark titles/slugs
  const articleIds = bookmarks.filter((b) => b.targetType === "article").map((b) => b.targetId);
  const questionIds = bookmarks.filter((b) => b.targetType === "question").map((b) => b.targetId);
  const softwareIds = bookmarks.filter((b) => b.targetType === "software").map((b) => b.targetId);

  const [bmArticles, bmQuestions, bmSoftware] = await Promise.all([
    articleIds.length > 0
      ? prisma.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, title: true, slug: true } })
      : [],
    questionIds.length > 0
      ? prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, title: true, slug: true } })
      : [],
    softwareIds.length > 0
      ? prisma.software.findMany({ where: { id: { in: softwareIds } }, select: { id: true, name: true, slug: true } })
      : [],
  ]);

  const bmTargets = new Map<string, { title: string; slug: string }>();
  for (const a of bmArticles) bmTargets.set(a.id, { title: a.title, slug: a.slug });
  for (const q of bmQuestions) bmTargets.set(q.id, { title: q.title, slug: q.slug });
  for (const s of bmSoftware) bmTargets.set(s.id, { title: s.name, slug: s.slug });

  const resolvedBookmarks = bookmarks.map((b) => {
    const target = bmTargets.get(b.targetId);
    return {
      id: b.id,
      targetType: b.targetType,
      targetId: b.targetId,
      createdAt: b.createdAt,
      targetTitle: target?.title,
      targetSlug: target?.slug,
    };
  });

  // Build recent activity
  const recentActivity = [
    ...articles.map((a) => ({ type: "article", title: a.title, slug: a.slug, date: formatDate(a.createdAt) })),
    ...questions.map((q) => ({ type: "question", title: q.title, slug: q.slug, date: formatDate(q.createdAt) })),
    ...software.map((s) => ({ type: "software", title: s.name, slug: s.slug, date: formatDate(s.createdAt) })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return successResponse({
    user,
    stats: { articleCount, questionCount, answerCount, softwareCount },
    bookmarks: resolvedBookmarks,
    recentActivity,
  });
});