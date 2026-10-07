import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { readJson } from "@/lib/request";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * The body used to be cast instead of validated: `null` (valid JSON) blew up on
 * destructuring and the catch-all turned it into a 500, and an unknown target
 * type was only rejected after the fact.
 */
const bookmarkSchema = z.object({
  targetType: z.enum(["article", "question", "software"]),
  targetId: z.string().min(1).max(64),
});

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookmarks);
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.bookmark") }) },
      { status: 500 }
    );
  }
}

async function targetExists(targetType: string, targetId: string): Promise<boolean> {
  switch (targetType) {
    case "article":
      return !!(await prisma.article.findUnique({ where: { id: targetId }, select: { id: true } }));
    case "question":
      return !!(await prisma.question.findUnique({ where: { id: targetId }, select: { id: true } }));
    case "software":
      return !!(await prisma.software.findUnique({ where: { id: targetId }, select: { id: true } }));
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    // Bookmarks had no quota at all before; a script could hammer the table.
    const { allowed } = checkRateLimit(getRateLimitKey(req, "bookmark"), {
      windowMs: 60000,
      maxRequests: 30,
    });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
    }

    const parsed = bookmarkSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json({ error: t("missingTarget") }, { status: 400 });
    }
    const { targetType, targetId } = parsed.data;

    const userId = (session.user as any).id;

    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_targetType_targetId: { userId, targetType, targetId },
      },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false, message: t("bookmarkRemoved") });
    }

    if (!(await targetExists(targetType, targetId))) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.bookmark") }) },
        { status: 404 }
      );
    }

    try {
      const bookmark = await prisma.bookmark.create({
        data: { userId, targetType, targetId },
      });

      return NextResponse.json(
        { bookmarked: true, bookmark, message: t("bookmarkAdded") },
        { status: 201 }
      );
    } catch (error) {
      // Two concurrent clicks: the other request won the unique constraint, so
      // report the state that actually holds instead of a 500.
      if ((error as { code?: string }).code === "P2002") {
        const bookmark = await prisma.bookmark.findUnique({
          where: { userId_targetType_targetId: { userId, targetType, targetId } },
        });
        return NextResponse.json({ bookmarked: true, bookmark, message: t("bookmarkAdded") });
      }
      throw error;
    }
  } catch (error) {
    console.error("bookmark failed", error);
    return NextResponse.json({ error: t("bookmarkFailed") }, { status: 500 });
  }
}
