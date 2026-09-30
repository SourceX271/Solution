import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const VOTE_TARGETS = ["article", "question", "answer", "software"] as const;
type VoteTarget = (typeof VOTE_TARGETS)[number];

async function targetExists(targetType: string, targetId: string): Promise<boolean> {
  switch (targetType) {
    case "article":
      return !!(await prisma.article.findUnique({ where: { id: targetId }, select: { id: true } }));
    case "question":
      return !!(await prisma.question.findUnique({ where: { id: targetId }, select: { id: true } }));
    case "answer":
      return !!(await prisma.answer.findUnique({ where: { id: targetId }, select: { id: true } }));
    case "software":
      return !!(await prisma.software.findUnique({ where: { id: targetId }, select: { id: true } }));
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "vote"), { windowMs: 60000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ error: "操作过于频繁" }, { status: 429 });
    }

    const body = await req.json();
    const { targetType, targetId, value } = body as { targetType: string; targetId: string; value: number };

    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }

    // Whitelist the target type: an arbitrary string used to be accepted and
    // written into the Vote table, creating orphan rows nothing could clean up.
    if (!(VOTE_TARGETS as readonly string[]).includes(targetType)) {
      return NextResponse.json({ error: "无效的目标类型" }, { status: 400 });
    }

    if (!(await targetExists(targetType, targetId))) {
      return NextResponse.json({ error: "投票目标不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;

    // Software rating: allow values 1-5
    if (targetType === "software") {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return NextResponse.json({ error: "评分值必须为1-5的整数" }, { status: 400 });
      }

      // Write the rating and the denormalised aggregates atomically, otherwise
      // two concurrent raters can leave Software.rating out of sync.
      const { rating, ratingCount, cancelled, isUpdate } = await prisma.$transaction(async (tx) => {
        const existing = await tx.vote.findUnique({
          where: { userId_targetType_targetId: { userId, targetType, targetId } },
        });

        const cancel = !!existing && existing.value === value;
        if (cancel) {
          await tx.vote.delete({ where: { id: existing!.id } });
        } else if (existing) {
          await tx.vote.update({ where: { id: existing.id }, data: { value } });
        } else {
          await tx.vote.create({ data: { userId, targetType, targetId, value } });
        }

        const agg = await tx.vote.aggregate({
          where: { targetType: "software", targetId },
          _sum: { value: true },
          _count: true,
        });
        const count = agg._count;
        const nextRating = count > 0 ? Math.round(((agg._sum?.value ?? 0) / count) * 10) / 10 : 0;

        await tx.software.update({
          where: { id: targetId },
          data: { rating: nextRating, ratingCount: count },
        });

        return { rating: nextRating, ratingCount: count, cancelled: cancel, isUpdate: !!existing };
      });

      return NextResponse.json({
        voted: !cancelled,
        message: cancelled ? "已取消评分" : isUpdate ? "已更新评分" : "评分成功",
        rating,
        ratingCount,
      });
    }

    // Upvote/Downvote for articles, questions, answers (value must be 1 or -1)
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: "投票值必须为1或-1" }, { status: 400 });
    }

    const existing = await prisma.vote.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });

    // Only question/answer carry a denormalized voteCount; article's votes are
    // counted via the Vote table directly, so nothing to sync there.
    const adjustVoteCount = (delta: number) => {
      if (targetType === "question") {
        return prisma.question.update({
          where: { id: targetId },
          data: { voteCount: { increment: delta } },
        });
      }
      if (targetType === "answer") {
        return prisma.answer.update({
          where: { id: targetId },
          data: { voteCount: { increment: delta } },
        });
      }
      return null;
    };

    if (existing) {
      if (existing.value === value) {
        // Cancel vote: remove the vote and roll back the count it contributed.
        await prisma.$transaction([
          prisma.vote.delete({ where: { id: existing.id } }),
          ...(targetType === "question" || targetType === "answer"
            ? [adjustVoteCount(-existing.value) as any]
            : []),
        ]);
        return NextResponse.json({ voted: false, message: "已取消投票" });
      } else {
        // Switch vote direction: adjust count by the difference (e.g. +1 -> -1 is -2).
        await prisma.$transaction([
          prisma.vote.update({ where: { id: existing.id }, data: { value } }),
          ...(targetType === "question" || targetType === "answer"
            ? [adjustVoteCount(value - existing.value) as any]
            : []),
        ]);
        return NextResponse.json({ voted: true, message: "已更新投票" });
      }
    } else {
      const [vote] = await prisma.$transaction([
        prisma.vote.create({ data: { userId, targetType, targetId, value } }),
        ...(targetType === "question" || targetType === "answer"
          ? [adjustVoteCount(value) as any]
          : []),
      ]);

      return NextResponse.json({ voted: true, vote, message: "投票成功" }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");
  const session = await auth();
  const userId = (session?.user as any)?.id;

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const [upVotes, downVotes, userVote] = await Promise.all([
    prisma.vote.count({ where: { targetType, targetId, value: { gt: 0 } } }),
    prisma.vote.count({ where: { targetType, targetId, value: { lt: 0 } } }),
    userId
      ? prisma.vote.findUnique({ where: { userId_targetType_targetId: { userId, targetType, targetId } } })
      : null,
  ]);

  return NextResponse.json({ upVotes, downVotes, userVote: userVote?.value ?? null });
}
