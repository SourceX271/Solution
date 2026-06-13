import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

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

    const userId = (session.user as any).id;

    // Software rating: allow values 1-5
    if (targetType === "software") {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return NextResponse.json({ error: "评分值必须为1-5的整数" }, { status: 400 });
      }

      const existing = await prisma.vote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
      });

      let oldValue = 0;
      if (existing) {
        oldValue = existing.value;
        if (existing.value === value) {
          // Cancel rating
          await prisma.vote.delete({ where: { id: existing.id } });
          // Recalculate software rating
          const agg = await prisma.vote.aggregate({
            where: { targetType: "software", targetId },
            _sum: { value: true },
            _count: true,
          });
          const newCount = agg._count;
          const newRating = newCount > 0 ? (agg._sum?.value ?? 0) / newCount : 0;
          await prisma.software.update({
            where: { id: targetId },
            data: { rating: Math.round(newRating * 10) / 10, ratingCount: newCount },
          });
          return NextResponse.json({
            voted: false,
            message: "已取消评分",
            rating: Math.round(newRating * 10) / 10,
            ratingCount: newCount,
          });
        } else {
          // Update rating
          await prisma.vote.update({
            where: { id: existing.id },
            data: { value },
          });
        }
      } else {
        // New rating
        await prisma.vote.create({
          data: { userId, targetType, targetId, value },
        });
      }

      // Recalculate with transaction correctness
      const agg = await prisma.vote.aggregate({
        where: { targetType: "software", targetId },
        _sum: { value: true },
        _count: true,
      });
      const newCount = agg._count;
      const newRating = newCount > 0 ? (agg._sum?.value ?? 0) / newCount : 0;
      const roundedRating = Math.round(newRating * 10) / 10;

      await prisma.software.update({
        where: { id: targetId },
        data: { rating: roundedRating, ratingCount: newCount },
      });

      const isUpdate = existing ? true : false;
      return NextResponse.json({
        voted: true,
        message: isUpdate ? "已更新评分" : "评分成功",
        rating: roundedRating,
        ratingCount: newCount,
      });
    }

    // Upvote/Downvote for articles, questions, answers (value must be 1 or -1)
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: "投票值必须为1或-1" }, { status: 400 });
    }

    const existing = await prisma.vote.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });

    if (existing) {
      if (existing.value === value) {
        await prisma.vote.delete({ where: { id: existing.id } });
        return NextResponse.json({ voted: false, message: "已取消投票" });
      } else {
        const updated = await prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        });
        return NextResponse.json({ voted: true, vote: updated, message: "已更新投票" });
      }
    } else {
      const vote = await prisma.vote.create({
        data: { userId, targetType, targetId, value },
      });

      // Update vote counts on target
      if (targetType === "question") {
        await prisma.question.update({
          where: { id: targetId },
          data: { voteCount: { increment: value > 0 ? 1 : -1 } },
        });
      } else if (targetType === "answer") {
        await prisma.answer.update({
          where: { id: targetId },
          data: { voteCount: { increment: value > 0 ? 1 : -1 } },
        });
      }

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
