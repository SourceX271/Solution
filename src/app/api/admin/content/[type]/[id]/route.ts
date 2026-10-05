import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateContent } from "@/lib/revalidate";
import { buildTagUpdate, bumpTagUsage, syncTagUsage } from "@/lib/tags";

const contentUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().max(200000).optional(),
  // The admin edit form sends `null` to clear a field; zod `.optional()` alone
  // rejects null and made every save with an empty excerpt/url fail with 400.
  excerpt: z.string().max(500).nullable().optional(),
  problem: z.string().max(2000).nullable().optional(),
  category: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(50000).optional(),
  url: z.string().max(500).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  image: z.string().max(500).nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

type ContentType = "articles" | "questions" | "software";

const ALLOWED_FIELDS: Record<ContentType, string[]> = {
  articles: ["title", "content", "excerpt", "problem", "category", "status", "coverImage"],
  questions: ["title", "content", "status"],
  software: ["name", "description", "url", "category", "status", "image"],
};

/**
 * Statuses the rest of the site actually understands.
 *
 * `questions` used to accept "resolved" here while the public pages and the
 * answer-accept endpoint use "solved" — picking "resolved" in the admin form
 * silently dropped the "solved" badge from the public question.
 */
const ALLOWED_STATUS: Record<ContentType, string[]> = {
  articles: ["published", "draft"],
  questions: ["open", "closed", "solved"],
  software: ["published", "pending", "draft"],
};

function isContentType(value: string): value is ContentType {
  return value === "articles" || value === "questions" || value === "software";
}

/** Map the URL segment to the audit/target vocabulary used by the rest of the app. */
const TARGET_BY_TYPE: Record<ContentType, string> = {
  articles: "article",
  questions: "question",
  software: "software",
};

/** Remove polymorphic Vote/Bookmark rows that point at deleted content. */
async function purgeOrphans(targetType: string, targetId: string) {
  await Promise.all([
    prisma.vote.deleteMany({ where: { targetType, targetId } }),
    prisma.bookmark.deleteMany({ where: { targetType, targetId } }),
  ]);
}

async function findContent(type: ContentType, id: string) {
  switch (type) {
    case "articles":
      return prisma.article.findUnique({
        where: { id },
        select: { id: true, slug: true, title: true, status: true, tags: { select: { slug: true } } },
      });
    case "questions":
      return prisma.question.findUnique({
        where: { id },
        select: { id: true, slug: true, title: true, status: true, tags: { select: { slug: true } } },
      });
    case "software":
      return prisma.software.findUnique({
        where: { id },
        select: { id: true, slug: true, name: true, status: true, tags: { select: { slug: true } } },
      });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { type, id } = params;
  if (!isContentType(type)) {
    return NextResponse.json({ error: t("invalidType") }, { status: 400 });
  }

  const existing = await findContent(type, id);
  if (!existing) {
    return NextResponse.json({ error: t("notFound", { entity: t(`entity.${TARGET_BY_TYPE[type]}`) }) }, { status: 404 });
  }

  try {
    switch (type) {
      case "articles":
        await prisma.article.delete({ where: { id } });
        await purgeOrphans("article", id);
        await bumpTagUsage(existing.tags.map((tag) => tag.slug), -1);
        break;
      case "questions":
        await prisma.question.delete({ where: { id } });
        await purgeOrphans("question", id);
        await bumpTagUsage(existing.tags.map((tag) => tag.slug), -1);
        break;
      case "software":
        await prisma.software.delete({ where: { id } });
        await purgeOrphans("software", id);
        await bumpTagUsage(existing.tags.map((tag) => tag.slug), -1);
        break;
    }

    await logAdminAction({
      actor: guard.user,
      action: "content.delete",
      targetType: TARGET_BY_TYPE[type],
      targetId: id,
      targetLabel: "title" in existing ? existing.title : existing.name,
      req,
    });
    revalidateContent(type, existing.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin content delete failed", error);
    return NextResponse.json({ error: t("deleteFailed", { entity: t(`entity.${TARGET_BY_TYPE[type]}`) }) }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { type, id } = params;
  if (!isContentType(type)) {
    return NextResponse.json({ error: t("invalidType") }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = contentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `${t("validationFailed")}: ${parsed.error.errors.map((e) => e.path.join(".")).join(", ")}` },
      { status: 400 }
    );
  }

  if (parsed.data.status && !ALLOWED_STATUS[type].includes(parsed.data.status)) {
    return NextResponse.json({ error: t("invalidStatus") }, { status: 400 });
  }

  const keys = ALLOWED_FIELDS[type];
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const value = parsed.data[key as keyof typeof parsed.data];
    if (value !== undefined) {
      data[key] = value;
    }
  }

  // Tags are a relation, not a column; `buildTagUpdate` also normalises the
  // shapes the different forms send (array / JSON string / "a, b"). It returns
  // null when the request did not mention tags, leaving the relation untouched.
  const tagUpdate = await buildTagUpdate(parsed.data.tags);

  const existing = await findContent(type, id);
  if (!existing) {
    return NextResponse.json({ error: t("notFound", { entity: t(`entity.${TARGET_BY_TYPE[type]}`) }) }, { status: 404 });
  }

  try {
    // `data` is assembled from a per-type allow-list, so it cannot be typed
    // against a single Prisma model; the switch picks the right one.
    const payload: Record<string, unknown> = tagUpdate ? { ...data, tags: tagUpdate.data } : data;
    switch (type) {
      case "articles":
        await prisma.article.update({ where: { id }, data: payload as never });
        break;
      case "questions":
        await prisma.question.update({ where: { id }, data: payload as never });
        break;
      case "software":
        await prisma.software.update({ where: { id }, data: payload as never });
        break;
    }

    // The tag relation is replaced wholesale, so the denormalized counters must
    // be reconciled against the diff — otherwise every tag edit skews them further.
    if (tagUpdate) {
      await syncTagUsage(existing.tags.map((tag) => tag.slug), tagUpdate.slugs);
    }

    await logAdminAction({
      actor: guard.user,
      action: "content.update",
      targetType: TARGET_BY_TYPE[type],
      targetId: id,
      targetLabel: "title" in existing ? existing.title : existing.name,
      metadata: { fields: Object.keys(data), tags: parsed.data.tags !== undefined },
      req,
    });
    revalidateContent(type, existing.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin content update failed", error);
    return NextResponse.json({ error: t("updateFailed", { entity: t(`entity.${TARGET_BY_TYPE[type]}`) }) }, { status: 500 });
  }
}
