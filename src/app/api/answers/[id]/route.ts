import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { answerSchema } from "@/lib/validations";
import { sanitizeHtml } from "@/lib/sanitize";
import { createNotification } from "@/lib/notifications";

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
      data: { content: await sanitizeHtml(parsed.data.content) },
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

    // Keep the denormalised counters and the question status consistent with
    // the deleted answer, in a single transaction.
    await prisma.$transaction(async (tx) => {
      await tx.answer.delete({ where: { id: params.id } });

      const question = await tx.question.findUnique({
        where: { id: answer.questionId },
        select: { answerCount: true, status: true },
      });

      await tx.question.update({
        where: { id: answer.questionId },
        data: {
          answerCount: Math.max(0, (question?.answerCount ?? 1) - 1),
          // Deleting the accepted answer reopens the question.
          ...(answer.accepted && question?.status === "solved" ? { status: "open" } : {}),
        },
      });
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
      include: { question: { select: { id: true, authorId: true, title: true, slug: true } } },
    });
    if (!answer) {
      return NextResponse.json({ error: "回答不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    if (answer.question.authorId !== userId) {
      return NextResponse.json({ error: "只有提问者可以采纳回答" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.answer.updateMany({
        where: { questionId: answer.questionId },
        data: { accepted: false },
      });

      const accepted = await tx.answer.update({
        where: { id: params.id },
        data: { accepted: true },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      // Accepting an answer marks the question as solved — without this the
      // "已解决" badge and the solved filter could never light up.
      await tx.question.update({
        where: { id: answer.questionId },
        data: { status: "solved" },
      });

      return accepted;
    });

    await createNotification({
      userId: answer.authorId,
      actorId: userId,
      type: "accepted",
      message: `${session.user?.name || "提问者"} 采纳了你在「${answer.question.title}」下的回答`,
      link: `/questions/${answer.question.slug}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "采纳回答失败" }, { status: 500 });
  }
}
