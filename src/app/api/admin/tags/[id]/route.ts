import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateTags } from "@/lib/revalidate";
import { detachTagEverywhere } from "@/lib/tags";
import { readJson } from "@/lib/request";

/**
 * The tag `slug` is deliberately not editable: it is the public URL
 * (`/tags/<slug>`) and changing it would break existing links. Renaming only
 * changes the display name.
 */
const tagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional(),
  description: z.string().max(200).nullable().optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = params;
  const tag = await prisma.tag.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  if (!tag) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.tag") }) }, { status: 404 });
  }

  const body = await readJson(req);
  const parsed = tagUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }

  // Names are compared case-insensitively: "React" and "react" are the same tag
  // to a reader, and Tag.name's unique index is case-sensitive.
  if (parsed.data.name) {
    const others = await prisma.tag.findMany({
      where: { id: { not: id } },
      select: { name: true },
    });
    const wanted = parsed.data.name.toLowerCase();
    if (others.some((other) => other.name.toLowerCase() === wanted)) {
      return NextResponse.json({ error: t("tagExists") }, { status: 409 });
    }
  }

  try {
    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description || null }
          : {}),
      },
    });

    await logAdminAction({
      actor: guard.user,
      action: "tag.update",
      targetType: "tag",
      targetId: id,
      targetLabel: updated.name,
      metadata: { before: tag.name, after: updated.name },
      req,
    });
    revalidateTags([updated.slug]);

    return NextResponse.json({ success: true, tag: updated });
  } catch (error) {
    console.error("Tag update failed", error);
    return NextResponse.json({ error: t("updateFailed", { entity: t("entity.tag") }) }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = params;
  const tag = await prisma.tag.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { articles: true, questions: true, software: true } },
    },
  });
  if (!tag) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.tag") }) }, { status: 404 });
  }

  const usage = tag._count.articles + tag._count.questions + tag._count.software;
  const force = new URL(req.url).searchParams.get("force") === "1";

  // Removing a tag that is still in use silently strips it from that content,
  // so it must be an explicit choice.
  if (usage > 0 && !force) {
    return NextResponse.json({ error: t("tagInUse", { count: usage }) }, { status: 409 });
  }

  try {
    const detached = await detachTagEverywhere(id);
    await prisma.tag.delete({ where: { id } });

    await logAdminAction({
      actor: guard.user,
      action: "tag.delete",
      targetType: "tag",
      targetId: id,
      targetLabel: tag.name,
      metadata: { detached },
      req,
    });
    revalidateTags([tag.slug]);

    return NextResponse.json({ success: true, detached });
  } catch (error) {
    console.error("Tag delete failed", error);
    return NextResponse.json({ error: t("deleteFailed", { entity: t("entity.tag") }) }, { status: 500 });
  }
}
