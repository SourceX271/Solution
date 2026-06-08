import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { answerSchema } from "@/lib/validations";

export async function POST(
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

    const body = await req.json();
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const answer = await prisma.answer.create({
      data: {
        content: parsed.data.content,
        questionId: params.id,
        authorId: (session.user as any).id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    await prisma.question.update({
      where: { id: params.id },
      data: { answerCount: { increment: 1 } },
    });

    return NextResponse.json(answer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建回答失败" }, { status: 500 });
  }
}
