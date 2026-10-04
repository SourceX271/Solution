import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";

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

const BOOKMARK_TARGETS = ["article", "question", "software"] as const;

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

    const body = await req.json();
    const { targetType, targetId } = body as { targetType: string; targetId: string };

    if (!targetType || !targetId) {
      return NextResponse.json({ error: t("missingTarget") }, { status: 400 });
    }

    if (!(BOOKMARK_TARGETS as readonly string[]).includes(targetType)) {
      return NextResponse.json({ error: t("invalidTargetType") }, { status: 400 });
    }

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

    const bookmark = await prisma.bookmark.create({
      data: { userId, targetType, targetId },
    });

    return NextResponse.json(
      { bookmarked: true, bookmark, message: t("bookmarkAdded") },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: t("bookmarkFailed") },
      { status: 500 }
    );
  }
}
