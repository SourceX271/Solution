import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runCrawler } from "@/lib/crawler-ingest";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const source = new URL(req.url).searchParams.get("source") || undefined;

    const result = await runCrawler({ source });

    return NextResponse.json({
      status: result.status,
      message: result.message,
      total: result.total,
      added: result.added,
      skipped: result.skipped,
      sourcesProcessed: result.sourcesProcessed,
    });
  } catch {
    return NextResponse.json({ error: "触发爬虫失败" }, { status: 500 });
  }
}
