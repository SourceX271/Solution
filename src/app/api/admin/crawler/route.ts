import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";

const crawlerSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  category: z.string().max(50).default("tech"),
  enabled: z.boolean().default(true),
});

export async function POST(req: Request) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = crawlerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("validationFailed") }, { status: 400 });
  }

  try {
    const source = await prisma.crawlSource.create({ data: parsed.data });
    await logAdminAction({
      actor: guard.user,
      action: "crawler.source.create",
      targetType: "crawler",
      targetId: source.id,
      targetLabel: source.name,
      metadata: { url: source.url, category: source.category },
      req,
    });
    return NextResponse.json({ success: true, data: source });
  } catch (error) {
    console.error("Crawl source create failed", error);
    return NextResponse.json({ error: t("createFailed", { entity: t("entity.crawler") }) }, { status: 500 });
  }
}
