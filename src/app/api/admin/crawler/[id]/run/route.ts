import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { runCrawler } from "@/lib/crawler-ingest"

// Known crawler source keys (crawler/main.py SOURCES). CrawlSource.name is a
// display name; map common display names to the CLI key so single-source runs
// work. Unknown names fall back to a full crawl.
const SOURCE_KEY_ALIASES: Record<string, string> = {
  devto: "devto",
  "dev.to": "devto",
  stackoverflow_blog: "stackoverflow_blog",
  stackoverflow: "stackoverflow_blog",
  "stack overflow": "stackoverflow_blog",
  "stack overflow blog": "stackoverflow_blog",
  csdn: "csdn",
  zhihu: "zhihu",
  cnblogs: "cnblogs",
  hashnode: "hashnode",
  hackernews: "hackernews",
  "hacker news": "hackernews",
}

function resolveSourceKey(name: string): string | undefined {
  const key = name.trim().toLowerCase()
  return SOURCE_KEY_ALIASES[key]
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const source = await prisma.crawlSource.findUnique({ where: { id: params.id } })
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  const sourceKey = resolveSourceKey(source.name)
  const result = await runCrawler({ source: sourceKey })

  if (result.status === "success") {
    await prisma.crawlSource.update({
      where: { id: params.id },
      data: { lastRun: new Date() },
    })
  }

  return NextResponse.json({
    success: result.status === "success",
    message: result.message,
    added: result.added,
    skipped: result.skipped,
    sourceKey: sourceKey ?? null,
  })
}
