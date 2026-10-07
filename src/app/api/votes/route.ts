import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const VOTE_TARGETS = ["article", "question", "answer", "software"] as const;
type VoteTarget = (typeof VOTE_TARGETS)[number];

/**
 * The body used to be cast instead of validated: `null` (a perfectly valid JSON
 * document) blew up on destructuring and the catch-all turned it into a 500, and
 * a string `targetId` reached Prisma and did the same.
 */
const voteSchema = z.object({
  targetType: z.enum(VOTE_TARGETS),
  targetId: z.string().min(1).max(64),
  value: z.number().int(),
});

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
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "vote"), { windowMs: 60000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimitedShort") }, { status: 429 });
    }

    const body = await readJson(req);
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: t("missingTarget") }, { status: 400 });
    }
    const { targetType, targetId, value } = parsed.data;

    if (!(await targetExists(targetType, targetId))) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.voteTarget") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;

    // Software rating: allow values 1-5
    if (targetType === "software") {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return NextResponse.json({ error: t("ratingRange") }, { status: 400 });
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
        message: cancelled
          ? t("ratingCancelled")
          : isUpdate
            ? t("ratingUpdated")
            : t("ratingSuccess"),
        rating,
        ratingCount,
      });
    }

    // Upvote/Downvote for articles, questions, answers (value must be 1 or -1)
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: t("voteRange") }, { status: 400 });
    }

    // Everything happens inside one interactive transaction: the "read the old
    // value, then adjust by the difference" pattern used to run the read
    // *outside*, so two concurrent switches (two tabs, a retry) both applied
    // their delta and drove `voteCount` below the real sum (-3 for a single
    // downvote). Recounting the votes themselves is self-correcting.
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.vote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
      });

      let cancelled = false;
      if (existing && existing.value === value) {
        await tx.vote.delete({ where: { id: existing.id } });
        cancelled = true;
      } else {
        // Upsert instead of create: a duplicate request that lost the race would
        // otherwise raise P2002 and turn into a 500.
        await tx.vote.upsert({
          where: { userId_targetType_targetId: { userId, targetType, targetId } },
          update: { value },
          create: { userId, targetType, targetId, value },
        });
      }

      // Only question/answer carry a denormalized voteCount; article's votes are
      // counted from the Vote table directly, so nothing to sync there.
      if (targetType === "question" || targetType === "answer") {
        const agg = await tx.vote.aggregate({
          where: { targetType, targetId },
          _sum: { value: true },
        });
        const total = agg._sum.value ?? 0;
        if (targetType === "question") {
          await tx.question.update({ where: { id: targetId }, data: { voteCount: total } });
        } else {
          await tx.answer.update({ where: { id: targetId }, data: { voteCount: total } });
        }
      }

      return { cancelled, isUpdate: !!existing };
    });

    if (outcome.cancelled) {
      return NextResponse.json({ voted: false, message: t("voteCancelled") });
    }
    if (outcome.isUpdate) {
      return NextResponse.json({ voted: true, message: t("voteUpdated") });
    }
    return NextResponse.json({ voted: true, message: t("voteSuccess") }, { status: 201 });
  } catch (error) {
    console.error("vote failed", error);
    return NextResponse.json({ error: t("voteFailed") }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");
  const session = await auth();
  const userId = (session?.user as any)?.id;

  if (!targetType || !targetId) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
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
