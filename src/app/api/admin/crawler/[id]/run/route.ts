import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { getApiT } from "@/lib/api-i18n"
import { requireAdminApi } from "@/lib/admin-guard"
import { logAdminAction } from "@/lib/audit"
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
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const t = await getApiT("api")
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const source = await prisma.crawlSource.findUnique({ where: { id: params.id } })
  if (!source) {
    return NextResponse.json(
      { error: t("notFound", { entity: t("entity.crawler") }) },
      { status: 404 }
    )
  }

  const sourceKey = resolveSourceKey(source.name)
  if (!sourceKey) {
    // Falling back to a full crawl here used to silently crawl *every* source
    // when a display name had no mapping. Report it instead.
    return NextResponse.json(
      { error: t("crawlerSourceNameUnknown", { name: source.name }) },
      { status: 400 }
    )
  }

  const result = await runCrawler({ source: sourceKey })

  if (result.status === "success") {
    await prisma.crawlSource.update({
      where: { id: params.id },
      data: { lastRun: new Date() },
    })
  }

  await logAdminAction({
    actor: guard.user,
    action: "crawler.run",
    targetType: "crawler",
    targetId: params.id,
    targetLabel: source.name,
    metadata: {
      scope: "single",
      sourceKey,
      status: result.status,
      added: result.added,
      skipped: result.skipped,
    },
    req,
  })

  return NextResponse.json({
    success: result.status === "success",
    // `result.message` comes from the crawler and is a Chinese log line; return
    // the structured fields instead so the admin UI can localize it.
    status: result.status,
    added: result.added,
    skipped: result.skipped,
    sourceKey: sourceKey ?? null,
  })
}
