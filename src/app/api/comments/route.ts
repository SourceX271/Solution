import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { commentSchema } from "@/lib/validations";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

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
      orderBy: { createdAt: "asc" },
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

    const { allowed } = checkRateLimit(getRateLimitKey(req, "comment"), { windowMs: 30000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ error: "评论过于频繁，请稍后再试" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { content, targetType, targetId, parentId } = body as {
      content: string;
      targetType: string;
      targetId: string;
      parentId?: string;
    };
    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }

    const data: any = {
      content: parsed.data.content,
      authorId: (session.user as any).id,
    };

    // Resolve the target: this both validates the id (a bogus id used to fail
    // with a Prisma FK error → 500) and gives us the owner to notify.
    let ownerId: string | null = null;
    let link: string | null = null;

    if (targetType === "article") {
      const target = await prisma.article.findUnique({
        where: { id: targetId },
        select: { authorId: true, slug: true, title: true },
      });
      if (!target) return NextResponse.json({ error: "评论目标不存在" }, { status: 404 });
      data.articleId = targetId;
      ownerId = target.authorId;
      link = `/docs/${target.slug}`;
    } else if (targetType === "question") {
      const target = await prisma.question.findUnique({
        where: { id: targetId },
        select: { authorId: true, slug: true, title: true },
      });
      if (!target) return NextResponse.json({ error: "评论目标不存在" }, { status: 404 });
      data.questionId = targetId;
      ownerId = target.authorId;
      link = `/questions/${target.slug}`;
    } else if (targetType === "answer") {
      const target = await prisma.answer.findUnique({
        where: { id: targetId },
        select: { authorId: true, question: { select: { slug: true, title: true } } },
      });
      if (!target) return NextResponse.json({ error: "评论目标不存在" }, { status: 404 });
      data.answerId = targetId;
      ownerId = target.authorId;
      link = `/questions/${target.question.slug}`;
    } else if (targetType === "software") {
      const target = await prisma.software.findUnique({
        where: { id: targetId },
        select: { authorId: true, slug: true, name: true },
      });
      if (!target) return NextResponse.json({ error: "评论目标不存在" }, { status: 404 });
      data.softwareId = targetId;
      ownerId = target.authorId;
      link = `/software/${target.slug}`;
    } else {
      return NextResponse.json({ error: "无效的目标类型" }, { status: 400 });
    }

    // Support nested replies — but only to a comment on the *same* target.
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      const sameTarget =
        parentComment &&
        parentComment.articleId === (data.articleId ?? null) &&
        parentComment.questionId === (data.questionId ?? null) &&
        parentComment.answerId === (data.answerId ?? null) &&
        parentComment.softwareId === (data.softwareId ?? null);
      if (!sameTarget) {
        return NextResponse.json({ error: "回复的评论不存在" }, { status: 400 });
      }
      data.parentId = parentId;
    }

    const comment = await prisma.comment.create({
      data,
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    if (ownerId) {
      await createNotification({
        userId: ownerId,
        actorId: (session.user as any).id,
        type: "comment",
        message: `${session.user?.name || "有人"} 评论了你的内容`,
        link,
      });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建评论失败" }, { status: 500 });
  }
}