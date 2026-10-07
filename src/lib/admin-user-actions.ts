import { prisma } from "@/lib/db";
import type { AdminUser } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { bumpTagUsage } from "@/lib/tags";
import { purgeContentRelations } from "@/lib/content-purge";

/**
 * Business rules for moderating an account.
 *
 * These live in one place because the panel has two entry points for the same
 * operation (`/api/admin/users/[id]` and the older `/api/users` PUT). The older
 * one used to skip every safeguard: no self-demote check, no "keep one admin"
 * check and no audit entry.
 */

export type UserMutationErrorKey =
  | "invalidParams"
  | "notFound"
  | "selfDemote"
  | "selfBan"
  | "lastAdmin"
  | "cannotDeleteSelf";

export type UserMutationResult =
  | { ok: true; data: UserMutationPayload }
  | { ok: false; status: number; errorKey: UserMutationErrorKey };

interface UserMutationPayload {
  id: string;
  role: string;
  bannedAt: Date | null;
  banReason: string | null;
}

export interface UpdateUserInput {
  role?: "USER" | "ADMIN";
  banned?: boolean;
  banReason?: string | null;
}

export async function updateUserAccount(
  actor: AdminUser,
  targetId: string,
  input: UpdateUserInput,
  req?: Request | null
): Promise<UserMutationResult> {
  const { role, banned, banReason } = input;
  if (role === undefined && banned === undefined) {
    return { ok: false, status: 400, errorKey: "invalidParams" };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, bannedAt: true },
  });
  if (!target) return { ok: false, status: 404, errorKey: "notFound" };

  if (target.id === actor.id) {
    if (role === "USER") return { ok: false, status: 400, errorKey: "selfDemote" };
    if (banned === true) return { ok: false, status: 400, errorKey: "selfBan" };
  }

  // Losing the last usable administrator would lock everybody out of the panel.
  if (target.role === "ADMIN" && (role === "USER" || banned === true)) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", bannedAt: null } });
    if (activeAdmins <= 1) return { ok: false, status: 400, errorKey: "lastAdmin" };
  }

  const data: { role?: string; bannedAt?: Date | null; banReason?: string | null } = {};
  if (role !== undefined) data.role = role;
  if (banned !== undefined) {
    data.bannedAt = banned ? new Date() : null;
    data.banReason = banned ? banReason ?? null : null;
  } else if (banReason !== undefined && target.bannedAt) {
    data.banReason = banReason;
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data,
    select: { id: true, role: true, bannedAt: true, banReason: true },
  });

  if (role !== undefined && role !== target.role) {
    await logAdminAction({
      actor,
      action: "user.role.update",
      targetType: "user",
      targetId,
      targetLabel: target.email,
      metadata: { from: target.role, to: role },
      req,
    });
  }
  if (banned !== undefined && Boolean(target.bannedAt) !== banned) {
    await logAdminAction({
      actor,
      action: banned ? "user.ban" : "user.unban",
      targetType: "user",
      targetId,
      targetLabel: target.email,
      metadata: banned ? { reason: banReason ?? null } : {},
      req,
    });
  }

  return { ok: true, data: updated };
}

/**
 * Hard-delete an account and everything that belongs to it.
 *
 * Prisma has no cascade from User to the content relations, so the cleanup is
 * explicit: content is removed, polymorphic vote/bookmark rows are purged, tag
 * usage counters are corrected, and questions that lost their accepted answer
 * fall back to `open`.
 */
export async function deleteUserAccount(
  actor: AdminUser,
  targetId: string,
  req?: Request | null
): Promise<UserMutationResult> {
  if (targetId === actor.id) return { ok: false, status: 400, errorKey: "cannotDeleteSelf" };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, bannedAt: true, banReason: true },
  });
  if (!target) return { ok: false, status: 404, errorKey: "notFound" };

  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", bannedAt: null } });
    if (admins <= 1) return { ok: false, status: 400, errorKey: "lastAdmin" };
  }

  const [articles, questions, software, answers] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: targetId },
      select: { id: true, tags: { select: { slug: true } } },
    }),
    prisma.question.findMany({
      where: { authorId: targetId },
      select: { id: true, tags: { select: { slug: true } } },
    }),
    prisma.software.findMany({
      where: { authorId: targetId },
      select: { id: true, tags: { select: { slug: true } } },
    }),
    prisma.answer.findMany({
      where: { authorId: targetId },
      select: { id: true, questionId: true, accepted: true },
    }),
  ]);

  const affectedQuestionIds = [...new Set(answers.map((answer) => answer.questionId))];

  const tagUsage = new Map<string, number>();
  for (const item of [...articles, ...questions, ...software]) {
    for (const tag of item.tags) {
      tagUsage.set(tag.slug, (tagUsage.get(tag.slug) ?? 0) + 1);
    }
  }

  await prisma.$transaction(
    async (tx) => {
      // Polymorphic rows first: deleting a question also cascades its answers,
      // and neither cascade reaches Vote/Bookmark.
      for (const [type, items] of [
        ["article", articles],
        ["question", questions],
        ["software", software],
      ] as const) {
        if (!items.length) continue;
        await purgeContentRelations(tx, type, items.map((item) => item.id));
      }
      if (answers.length > 0) {
        await purgeContentRelations(tx, "answer", answers.map((answer) => answer.id));
      }

      await tx.article.deleteMany({ where: { authorId: targetId } });
      await tx.question.deleteMany({ where: { authorId: targetId } });
      await tx.software.deleteMany({ where: { authorId: targetId } });
      await tx.answer.deleteMany({ where: { authorId: targetId } });

      // Rows that belong to the account itself.
      await tx.comment.deleteMany({ where: { authorId: targetId } });
      await tx.vote.deleteMany({ where: { userId: targetId } });
      await tx.bookmark.deleteMany({ where: { userId: targetId } });
      await tx.notification.deleteMany({ where: { userId: targetId } });
      // Authored tags stay in the catalogue, just without an owner.
      await tx.tag.updateMany({ where: { createdBy: targetId }, data: { createdBy: null } });

      for (const questionId of affectedQuestionIds) {
        const remaining = await tx.answer.findMany({
          where: { questionId },
          select: { accepted: true },
        });
        const stillSolved = remaining.some((answer) => answer.accepted);
        // `updateMany`, not `update`: if the victim answered their *own*
        // question, that question was already deleted above and `update` threw
        // P2025, which rolled the whole transaction back and made the account
        // undeletable (HTTP 500).
        await tx.question.updateMany({
          where: { id: questionId },
          data: {
            answerCount: remaining.length,
            ...(stillSolved ? {} : { status: "open" }),
          },
        });
      }

      await tx.user.delete({ where: { id: targetId } });
    },
    { timeout: 20000 }
  );

  for (const [slug, count] of tagUsage) {
    await bumpTagUsage([slug], -count);
  }

  await logAdminAction({
    actor,
    action: "user.delete",
    targetType: "user",
    targetId,
    targetLabel: target.email,
    metadata: {
      articles: articles.length,
      questions: questions.length,
      software: software.length,
      answers: answers.length,
    },
    req,
  });

  return {
    ok: true,
    data: { id: targetId, role: target.role, bannedAt: null, banReason: null },
  };
}
