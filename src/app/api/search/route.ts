import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/** Two characters keeps `?q=a` from scanning three tables on every request. */
const MIN_QUERY_LENGTH = 2;

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ error: t("searchKeywordRequired") }, { status: 400 });
    }

    // Search had no quota at all: each call runs three `contains` scans.
    const { allowed } = checkRateLimit(getRateLimitKey(req, "search"), {
      windowMs: 60000,
      maxRequests: 60,
    });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
    }

    // `contains` has no length limit of its own; a 100 KB keyword is pure cost.
    const keyword = q.trim().slice(0, 100);

    const [articles, questions, software] = await Promise.all([
      prisma.article.findMany({
        where: {
          status: "published",
          OR: [
            { title: { contains: keyword } },
            { content: { contains: keyword } },
          ],
        },
        select: { id: true, title: true, excerpt: true, slug: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.question.findMany({
        where: {
          OR: [
            { title: { contains: keyword } },
            { content: { contains: keyword } },
          ],
        },
        select: { id: true, title: true, slug: true, answerCount: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.software.findMany({
        where: {
          status: "published",
          OR: [
            { name: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
        select: { id: true, name: true, description: true, slug: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const results = [
      ...articles.map((a) => ({ ...a, type: "article" })),
      ...questions.map((q) => ({ ...q, type: "question" })),
      ...software.map((s) => ({ ...s, type: "software" })),
    ];

    return NextResponse.json({ data: results, query: q });
  } catch (error) {
    return NextResponse.json({ error: t("searchFailed") }, { status: 500 });
  }
}
