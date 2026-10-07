import type { Prisma, PrismaClient } from "@prisma/client";

/** Content kinds that can be the target of a polymorphic Vote/Bookmark row. */
export type ContentTargetType = "article" | "question" | "answer" | "software";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Delete the polymorphic rows attached to content that is going away.
 *
 * `Vote` and `Bookmark` keep their target as a `targetType` + `targetId` pair
 * with **no foreign key**, so the database cannot cascade for them: every delete
 * path has to clean up explicitly (AGENTS.md §2.5). Skipping this left the dev
 * database with 4/4 votes and 1/1 bookmark pointing at deleted content, and
 * `/api/users/profile` then rendered bookmarks with an empty title.
 *
 * Deleting a question cascades its answers (schema-level `onDelete: Cascade`),
 * but *their* votes are not cascaded either — so the answer ids are collected
 * first. Call this **before** removing the content, inside the same transaction.
 */
export async function purgeContentRelations(
  db: Db,
  targetType: ContentTargetType,
  targetIds: string | string[]
): Promise<void> {
  const ids = (Array.isArray(targetIds) ? targetIds : [targetIds]).filter(Boolean);
  if (ids.length === 0) return;

  await db.vote.deleteMany({ where: { targetType, targetId: { in: ids } } });
  await db.bookmark.deleteMany({ where: { targetType, targetId: { in: ids } } });

  if (targetType === "question") {
    const answers = await db.answer.findMany({
      where: { questionId: { in: ids } },
      select: { id: true },
    });
    const answerIds = answers.map((answer) => answer.id);
    if (answerIds.length > 0) {
      await db.vote.deleteMany({ where: { targetType: "answer", targetId: { in: answerIds } } });
      await db.bookmark.deleteMany({ where: { targetType: "answer", targetId: { in: answerIds } } });
    }
  }
}
