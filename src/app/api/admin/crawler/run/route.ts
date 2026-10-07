import { NextRequest, NextResponse } from "next/server";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { runCrawler, isCrawlerSource } from "@/lib/crawler-ingest";

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const requested = new URL(req.url).searchParams.get("source") || undefined;
    if (requested && !isCrawlerSource(requested)) {
      return NextResponse.json({ error: t("crawlerUnknownSource") }, { status: 400 });
    }

    const result = await runCrawler({ source: requested });

    await logAdminAction({
      actor: guard.user,
      action: "crawler.run",
      targetType: "crawler",
      targetId: requested ?? "all",
      targetLabel: requested ?? "all",
      metadata: {
        scope: requested ? "single" : "all",
        status: result.status,
        added: result.added,
        skipped: result.skipped,
      },
      req,
    });

    return NextResponse.json({
      status: result.status,
      // No `message`: it is a Chinese log line produced by the crawler. The
      // admin UI renders the structured counters in the reader's language.
      total: result.total,
      added: result.added,
      skipped: result.skipped,
      sourcesProcessed: result.sourcesProcessed,
    });
  } catch (error) {
    console.error("Crawler trigger failed", error);
    return NextResponse.json({ error: t("crawlerTriggerFailed") }, { status: 500 });
  }
}
