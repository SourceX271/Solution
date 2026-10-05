import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateTags } from "@/lib/revalidate";
import { mergeTags, recomputeTagUsage } from "@/lib/tags";

const mergeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

/**
 * Merge one tag into another: every item tagged with `sourceId` is re-tagged
 * with `targetId`, then the source row is deleted.
 *
 * This is the repair path for duplicates ("react" / "reactjs") that would
 * otherwise need direct database access.
 */
export async function POST(req: Request) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }

  const { sourceId, targetId } = parsed.data;
  if (sourceId === targetId) {
    return NextResponse.json({ error: t("tagMergeSelf") }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.tag.findUnique({ where: { id: sourceId }, select: { id: true, name: true, slug: true } }),
    prisma.tag.findUnique({ where: { id: targetId }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!source || !target) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.tag") }) }, { status: 404 });
  }

  try {
    const moved = await mergeTags(sourceId, targetId);
    await prisma.tag.delete({ where: { id: sourceId } });
    // The target's counter (and anything else that had drifted) is now provably
    // recomputable, so rebuild it instead of guessing the delta.
    await recomputeTagUsage();

    await logAdminAction({
      actor: guard.user,
      action: "tag.merge",
      targetType: "tag",
      targetId: targetId,
      targetLabel: target.name,
      metadata: { source: source.name, sourceSlug: source.slug, moved },
      req,
    });
    revalidateTags([source.slug, target.slug]);

    return NextResponse.json({ success: true, moved });
  } catch (error) {
    console.error("Tag merge failed", error);
    return NextResponse.json({ error: t("tagMergeFailed") }, { status: 500 });
  }
}
