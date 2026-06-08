import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: "请输入搜索关键词" }, { status: 400 });
    }

    const keyword = q.trim();

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
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
