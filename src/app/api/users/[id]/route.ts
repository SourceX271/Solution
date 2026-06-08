import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        bio: true,
        createdAt: true,
        _count: {
          select: { articles: true, questions: true, answers: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "获取用户信息失败" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (params.id !== userId) {
      return NextResponse.json({ error: "只能修改自己的资料" }, { status: 403 });
    }

    const body = await req.json();
    const { name, bio, image } = body as { name?: string; bio?: string; image?: string };

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(image !== undefined && { image }),
      },
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

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "更新资料失败" }, { status: 500 });
  }
}
