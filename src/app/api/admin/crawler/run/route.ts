import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { runCrawler, isCrawlerSource } from "@/lib/crawler-ingest";

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: t("forbiddenAccess") }, { status: 403 });
    }

    const requested = new URL(req.url).searchParams.get("source") || undefined;
    if (requested && !isCrawlerSource(requested)) {
      return NextResponse.json({ error: t("crawlerUnknownSource") }, { status: 400 });
    }

    const result = await runCrawler({ source: requested });

    return NextResponse.json({
      status: result.status,
      message: result.message,
      total: result.total,
      added: result.added,
      skipped: result.skipped,
      sourcesProcessed: result.sourcesProcessed,
    });
  } catch {
    return NextResponse.json({ error: t("crawlerTriggerFailed") }, { status: 500 });
  }
}
