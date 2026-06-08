import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { articleSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, image: true, bio: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { comments: true } },
      },
    });

    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    await prisma.article.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 });
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

    const article = await prisma.article.findUnique({ where: { id: params.id } });
    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (article.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权修改此文章" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = articleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        excerpt: parsed.data.excerpt,
        category: parsed.data.category,
        status: parsed.data.status,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "更新文章失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const article = await prisma.article.findUnique({ where: { id: params.id } });
    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (article.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权删除此文章" }, { status: 403 });
    }

    await prisma.article.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "文章已删除" });
  } catch (error) {
    return NextResponse.json({ error: "删除文章失败" }, { status: 500 });
  }
}
