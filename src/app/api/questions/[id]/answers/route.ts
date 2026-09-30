import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { answerSchema } from "@/lib/validations";
import { sanitizeHtml } from "@/lib/sanitize";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "answer"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    }

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) {
      return NextResponse.json({ error: "问题不存在" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const authorId = (session.user as any).id as string;
    // Answers are rendered as HTML, so store sanitised markup.
    const content = await sanitizeHtml(parsed.data.content);

    const answer = await prisma.$transaction(async (tx) => {
      const created = await tx.answer.create({
        data: {
          content,
          questionId: params.id,
          authorId,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      await tx.question.update({
        where: { id: params.id },
        data: { answerCount: { increment: 1 } },
      });

      return created;
    });

    await createNotification({
      userId: question.authorId,
      actorId: authorId,
      type: "answer",
      message: `${session.user?.name || "有人"} 回答了你的问题「${question.title}」`,
      link: `/questions/${question.slug}`,
    });

    return NextResponse.json(answer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建回答失败" }, { status: 500 });
  }
}
