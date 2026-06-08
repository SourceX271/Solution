import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { commentSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");

    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }

    const where: any = {};
    if (targetType === "article") where.articleId = targetId;
    else if (targetType === "question") where.questionId = targetId;
    else if (targetType === "answer") where.answerId = targetId;
    else if (targetType === "software") where.softwareId = targetId;
    else return NextResponse.json({ error: "无效的目标类型" }, { status: 400 });

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { content, targetType, targetId } = body as { content: string; targetType: string; targetId: string };
    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }

    const data: any = {
      content: parsed.data.content,
      authorId: (session.user as any).id,
    };

    if (targetType === "article") data.articleId = targetId;
    else if (targetType === "question") data.questionId = targetId;
    else if (targetType === "answer") data.answerId = targetId;
    else if (targetType === "software") data.softwareId = targetId;
    else return NextResponse.json({ error: "无效的目标类型" }, { status: 400 });

    const comment = await prisma.comment.create({
      data,
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建评论失败" }, { status: 500 });
  }
}
