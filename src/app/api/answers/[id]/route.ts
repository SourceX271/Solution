import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { answerSchema } from "@/lib/validations";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const answer = await prisma.answer.findUnique({ where: { id: params.id } });
    if (!answer) {
      return NextResponse.json({ error: "回答不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (answer.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权修改此回答" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.answer.update({
      where: { id: params.id },
      data: { content: parsed.data.content },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "更新回答失败" }, { status: 500 });
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

    const answer = await prisma.answer.findUnique({ where: { id: params.id } });
    if (!answer) {
      return NextResponse.json({ error: "回答不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (answer.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权删除此回答" }, { status: 403 });
    }

    await prisma.answer.delete({ where: { id: params.id } });

    await prisma.question.update({
      where: { id: answer.questionId },
      data: { answerCount: { decrement: 1 } },
    });

    return NextResponse.json({ message: "回答已删除" });
  } catch (error) {
    return NextResponse.json({ error: "删除回答失败" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: params.id },
      include: { question: { select: { authorId: true } } },
    });
    if (!answer) {
      return NextResponse.json({ error: "回答不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    if (answer.question.authorId !== userId) {
      return NextResponse.json({ error: "只有提问者可以采纳回答" }, { status: 403 });
    }

    await prisma.answer.updateMany({
      where: { questionId: answer.questionId },
      data: { accepted: false },
    });

    const updated = await prisma.answer.update({
      where: { id: params.id },
      data: { accepted: true },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "采纳回答失败" }, { status: 500 });
  }
}
