import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export interface TagConnection {
  slug: string;
  name: string;
}

/**
 * 将用户输入的标签名解析为可用的 { name, slug } 连接数据。
 *
 * - 纯 ASCII 标签（如 "windows"）：直接用原名作为 slug（与现有行为一致，
 *   可匹配到 seed 中如 slug="windows" 的标签）。
 * - 含中文/非 ASCII 的标签（如 "性能优化"）：URL 不允许中文，先按 name
 *   查找已有标签（避免重复创建，Tag.name 为 unique），找不到则生成随机
 *   id 作为 slug，保证 /tags/<slug> 永远是纯 ASCII。
 */
export async function resolveTags(input: string[]): Promise<TagConnection[]> {
  const result: TagConnection[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const ascii = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (ascii && /^[a-z0-9-]+$/.test(ascii)) {
      result.push({ name, slug: ascii });
      continue;
    }

    const existing = await prisma.tag.findUnique({ where: { name } });
    result.push(
      existing ? { name, slug: existing.slug } : { name, slug: generateSlug() }
    );
  }

  return result;
}

/** 兼容旧入参：tags 可能是数组、JSON 字符串或逗号分隔字符串 */
export function parseTagInput(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — fall through to comma split
    }
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/** Maximum number of tags a single content item may carry. */
export const MAX_TAGS_PER_ITEM = 20;

export interface TagRelationUpdate {
  /** Slugs of the tags the item will end up with. */
  slugs: string[];
  /** Prisma nested-write payload that replaces the tag relation. */
  data: {
    set: { slug: string }[];
    connectOrCreate: { where: { slug: string }; create: { name: string; slug: string } }[];
  };
}

/**
 * Build the Prisma relation payload for a submitted tag list.
 *
 * Returns `null` when the request did not mention tags at all, so callers can
 * leave the existing relation untouched. An explicit empty list returns an
 * empty payload with `slugs: []`, which clears the tags (and, together with
 * `syncTagUsage`, rolls the counters back).
 *
 * Accepts every shape the forms have sent over time: a real array, a
 * JSON-encoded array, or a comma-separated string.
 */
export async function buildTagUpdate(tags: unknown): Promise<TagRelationUpdate | null> {
  if (tags === undefined) return null;

  const names = parseTagInput(tags).slice(0, MAX_TAGS_PER_ITEM);
  const resolved = names.length > 0 ? await resolveTags(names) : [];

  return {
    slugs: resolved.map((tag) => tag.slug),
    data: {
      set: [],
      connectOrCreate: resolved.map((tag) => ({
        where: { slug: tag.slug },
        create: { name: tag.name, slug: tag.slug },
      })),
    },
  };
}

/**
 * Keep Tag.usageCount in sync with the number of content items carrying the tag.
 *
 * Nothing used to update this column, so every tag showed "0" and the
 * "热门标签" ordering was meaningless. Failures are logged, never thrown:
 * the counter is a convenience, not the source of truth.
 */
export async function bumpTagUsage(slugs: string[], delta: number): Promise<void> {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (unique.length === 0) return;

  try {
    if (delta > 0) {
      await prisma.tag.updateMany({
        where: { slug: { in: unique } },
        data: { usageCount: { increment: delta } },
      });
    } else {
      // Never decrement below zero (e.g. content created before this counter existed).
      await prisma.tag.updateMany({
        where: { slug: { in: unique }, usageCount: { gt: 0 } },
        data: { usageCount: { increment: delta } },
      });
      // A bulk decrement larger than the stored count can still overshoot on
      // legacy rows, so clamp any negative result back to zero.
      await prisma.tag.updateMany({
        where: { slug: { in: unique }, usageCount: { lt: 0 } },
        data: { usageCount: 0 },
      });
    }
  } catch (error) {
    console.error("[tags] failed to update usageCount", unique, error);
  }
}

/**
 * Reconcile usageCount after a tag relation is replaced.
 *
 * Editing content rebuilds its tag set, which bumps the count of tags it gained
 * and drops the count of tags it lost. Without this the counter only ever grew
 * (a tag edit used to run `set: []` + connect and never adjust anything), so
 * 12 of 13 production tags ended up with a wrong count.
 *
 * @param prevSlugs tag slugs the item had before the change
 * @param nextSlugs tag slugs the item has after the change
 */
export async function syncTagUsage(prevSlugs: string[], nextSlugs: string[]): Promise<void> {
  const before = new Set(prevSlugs.filter(Boolean));
  const after = new Set(nextSlugs.filter(Boolean));

  const added = [...after].filter((slug) => !before.has(slug));
  const removed = [...before].filter((slug) => !after.has(slug));

  if (added.length > 0) await bumpTagUsage(added, 1);
  if (removed.length > 0) await bumpTagUsage(removed, -1);
}

/**
 * Rebuild every Tag.usageCount from the actual relations.
 *
 * usageCount is a denormalized convenience column: it can drift after bulk
 * edits, direct DB changes or legacy rows written before the counter existed.
 * This is the repair path — it is idempotent and cheap (one query per distinct
 * count value rather than one per tag).
 */
export async function recomputeTagUsage(): Promise<{ total: number; updated: number }> {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      usageCount: true,
      _count: { select: { articles: true, questions: true, software: true } },
    },
  });

  const idsByCount = new Map<number, string[]>();
  for (const tag of tags) {
    const actual = tag._count.articles + tag._count.questions + tag._count.software;
    if (actual === tag.usageCount) continue;
    const ids = idsByCount.get(actual) ?? [];
    ids.push(tag.id);
    idsByCount.set(actual, ids);
  }

  let updated = 0;
  for (const [count, ids] of idsByCount) {
    await prisma.tag.updateMany({ where: { id: { in: ids } }, data: { usageCount: count } });
    updated += ids.length;
  }

  return { total: tags.length, updated };
}

/** Content models that carry tags. */
const TAGGED_WHERE = (tagId: string) => ({ tags: { some: { id: tagId } } });

/**
 * Detach a tag from every content item (used before deleting the tag).
 *
 * `updateMany` cannot touch a relation, so the join rows are removed one item
 * at a time — tag usage is small enough that this stays cheap.
 */
export async function detachTagEverywhere(tagId: string): Promise<number> {
  const where = TAGGED_WHERE(tagId);
  const disconnect = { tags: { disconnect: { id: tagId } } };

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({ where, select: { id: true } }),
    prisma.question.findMany({ where, select: { id: true } }),
    prisma.software.findMany({ where, select: { id: true } }),
  ]);

  await Promise.all([
    ...articles.map((item) => prisma.article.update({ where: { id: item.id }, data: disconnect })),
    ...questions.map((item) => prisma.question.update({ where: { id: item.id }, data: disconnect })),
    ...software.map((item) => prisma.software.update({ where: { id: item.id }, data: disconnect })),
  ]);

  return articles.length + questions.length + software.length;
}

/**
 * Merge `sourceId` into `targetId`: every item tagged with the source is moved
 * onto the target, then the caller deletes the now-unused source tag.
 * Returns the number of items that were re-tagged.
 */
export async function mergeTags(sourceId: string, targetId: string): Promise<number> {
  const where = TAGGED_WHERE(sourceId);
  const swap = { tags: { disconnect: { id: sourceId }, connect: { id: targetId } } };

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({ where, select: { id: true } }),
    prisma.question.findMany({ where, select: { id: true } }),
    prisma.software.findMany({ where, select: { id: true } }),
  ]);

  await Promise.all([
    ...articles.map((item) => prisma.article.update({ where: { id: item.id }, data: swap })),
    ...questions.map((item) => prisma.question.update({ where: { id: item.id }, data: swap })),
    ...software.map((item) => prisma.software.update({ where: { id: item.id }, data: swap })),
  ]);

  return articles.length + questions.length + software.length;
}
