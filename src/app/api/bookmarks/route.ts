import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookmarks);
  } catch (error) {
    return NextResponse.json({ error: "获取收藏列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { targetType, targetId } = body as { targetType: string; targetId: string };

    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_targetType_targetId: { userId, targetType, targetId },
      },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false, message: "已取消收藏" });
    }

    const bookmark = await prisma.bookmark.create({
      data: { userId, targetType, targetId },
    });

    return NextResponse.json({ bookmarked: true, bookmark, message: "收藏成功" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "收藏操作失败" }, { status: 500 });
  }
}
