import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";

const crawlerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().max(500).optional(),
  category: z.string().max(50).optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = crawlerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("validationFailed") }, { status: 400 });
  }

  const existing = await prisma.crawlSource.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.crawler") }) }, { status: 404 });
  }

  try {
    const updated = await prisma.crawlSource.update({ where: { id: params.id }, data: parsed.data });
    await logAdminAction({
      actor: guard.user,
      action: "crawler.source.update",
      targetType: "crawler",
      targetId: updated.id,
      targetLabel: updated.name,
      metadata: parsed.data,
      req,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Crawl source update failed", error);
    return NextResponse.json({ error: t("updateFailed", { entity: t("entity.crawler") }) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const existing = await prisma.crawlSource.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.crawler") }) }, { status: 404 });
  }

  try {
    // CrawlLog rows are historical records of runs, not children of the source;
    // they are kept so the audit trail of past crawls stays intact.
    await prisma.crawlSource.delete({ where: { id: params.id } });
    await logAdminAction({
      actor: guard.user,
      action: "crawler.source.delete",
      targetType: "crawler",
      targetId: params.id,
      targetLabel: existing.name,
      metadata: { url: existing.url },
      req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Crawl source delete failed", error);
    return NextResponse.json({ error: t("deleteFailed", { entity: t("entity.crawler") }) }, { status: 500 });
  }
}
