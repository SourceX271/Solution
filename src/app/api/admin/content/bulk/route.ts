import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction, type AuditAction } from "@/lib/audit";
import { revalidateContentList } from "@/lib/revalidate";
import { bumpTagUsage } from "@/lib/tags";
import { readJson } from "@/lib/request";
import { purgeContentRelations, type ContentTargetType } from "@/lib/content-purge";

const bulkSchema = z.object({
  type: z.enum(["articles", "questions", "software"]),
  action: z.enum(["publish", "unpublish", "delete"]),
  ids: z.array(z.string().min(1).max(64)).min(1).max(200),
});

type BulkType = z.infer<typeof bulkSchema>["type"];

/** Which status means "visible" / "hidden" for each content type. */
const STATUS_BY_ACTION: Record<BulkType, { publish: string; unpublish: string }> = {
  articles: { publish: "published", unpublish: "draft" },
  questions: { publish: "open", unpublish: "closed" },
  software: { publish: "published", unpublish: "pending" },
};

const TARGET_BY_TYPE: Record<BulkType, string> = {
  articles: "article",
  questions: "question",
  software: "software",
};

const AUDIT_BY_ACTION: Record<z.infer<typeof bulkSchema>["action"], AuditAction> = {
  publish: "content.bulkPublish",
  unpublish: "content.bulkUnpublish",
  delete: "content.bulkDelete",
};

export async function POST(req: Request) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await readJson(req);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("validationFailed") }, { status: 400 });
  }

  const { type, action, ids } = parsed.data;
  const targetType = TARGET_BY_TYPE[type];
  let affected = 0;

  try {
    if (action === "delete") {
      const items = await (type === "articles"
        ? prisma.article.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true, title: true, tags: { select: { slug: true } } },
          })
        : type === "questions"
          ? prisma.question.findMany({
              where: { id: { in: ids } },
              select: { id: true, slug: true, title: true, tags: { select: { slug: true } } },
            })
          : prisma.software.findMany({
              where: { id: { in: ids } },
              select: { id: true, slug: true, name: true, tags: { select: { slug: true } } },
            }));

      if (items.length === 0) {
        return NextResponse.json({ success: true, affected: 0 });
      }

      const foundIds = items.map((item) => item.id);
      // usageCount must drop by one per article that carried the tag, so count
      // occurrences instead of using the (unrelated) number of deleted items.
      const tagUsage = new Map<string, number>();
      for (const item of items) {
        for (const tag of item.tags) {
          tagUsage.set(tag.slug, (tagUsage.get(tag.slug) ?? 0) + 1);
        }
      }

      await prisma.$transaction(async (tx) => {
        // Polymorphic rows have no database-level cascade, and deleting a
        // question also takes its answers: collect everything first.
        for (const id of foundIds) {
          await purgeContentRelations(tx, targetType as ContentTargetType, id);
        }
        if (type === "articles") {
          await tx.article.deleteMany({ where: { id: { in: foundIds } } });
        } else if (type === "questions") {
          await tx.question.deleteMany({ where: { id: { in: foundIds } } });
        } else {
          await tx.software.deleteMany({ where: { id: { in: foundIds } } });
        }
      });

      for (const [slug, count] of tagUsage) {
        await bumpTagUsage([slug], -count);
      }
      affected = items.length;

      await logAdminAction({
        actor: guard.user,
        action: AUDIT_BY_ACTION[action],
        targetType,
        targetId: foundIds.join(",").slice(0, 500),
        targetLabel: items
          .slice(0, 5)
          .map((item) => ("title" in item ? item.title : item.name))
          .join(" | ")
          .slice(0, 200),
        metadata: { count: items.length, ids: foundIds.slice(0, 50) },
        req,
      });
    } else {
      const status = STATUS_BY_ACTION[type][action];
      const where = { id: { in: ids } };
      // The three models share the same shape here; Prisma cannot express that
      // through one generic call, so branch explicitly.
      let count = 0;
      if (type === "articles") {
        count = (await prisma.article.updateMany({ where, data: { status } })).count;
      } else if (type === "questions") {
        count = (await prisma.question.updateMany({ where, data: { status } })).count;
      } else {
        count = (await prisma.software.updateMany({ where, data: { status } })).count;
      }
      affected = count;

      await logAdminAction({
        actor: guard.user,
        action: AUDIT_BY_ACTION[action],
        targetType,
        targetId: ids.join(",").slice(0, 500),
        metadata: { count, status },
        req,
      });
    }

    revalidateContentList(type);
    return NextResponse.json({ success: true, affected });
  } catch (error) {
    console.error("Bulk content action failed", error);
    return NextResponse.json({ error: t("serverError") }, { status: 500 });
  }
}
