import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { questionSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, image: true, bio: true } },
        tags: { select: { name: true, slug: true, color: true } },
        answers: {
          where: { accepted: true },
          include: {
            author: { select: { id: true, name: true, image: true } },
            _count: { select: { comments: true } },
          },
          orderBy: [{ accepted: "desc" }, { voteCount: "desc" }],
        },
        _count: { select: { comments: true, answers: true } },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "问题不存在" }, { status: 404 });
    }

    await prisma.question.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json({ error: "获取问题失败" }, { status: 500 });
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

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) {
      return NextResponse.json({ error: "问题不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (question.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权修改此问题" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.question.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "更新问题失败" }, { status: 500 });
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

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) {
      return NextResponse.json({ error: "问题不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (question.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权删除此问题" }, { status: 403 });
    }

    await prisma.question.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "问题已删除" });
  } catch (error) {
    return NextResponse.json({ error: "删除问题失败" }, { status: 500 });
  }
}
