import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { resolveTags, bumpTagUsage } from "@/lib/tags";

const execFileAsync = promisify(execFile);

/** Must stay in sync with SOURCES in crawler/main.py */
const CRAWLER_SOURCES = [
  "devto",
  "stackoverflow_blog",
  "csdn",
  "zhihu",
  "cnblogs",
  "hashnode",
  "hackernews",
] as const;

export type CrawlerSourceKey = (typeof CRAWLER_SOURCES)[number];

export function isCrawlerSource(value: string): value is CrawlerSourceKey {
  return (CRAWLER_SOURCES as readonly string[]).includes(value);
}

export interface CrawlResult {
  status: "success" | "error";
  total: number;
  added: number;
  skipped: number;
  sourcesProcessed: number;
  message: string;
}

interface CrawlerArticle {
  title?: string;
  content?: string;
  source_url?: string;
  tags?: string[];
  category?: string;
  author?: string;
}

interface CrawlerRunOutput {
  status: string;
  sources_processed?: number;
  total?: number;
  articles?: CrawlerArticle[];
  results?: Array<{ source: string; count: number; status: string }>;
}

const CRAWLER_EMAIL = "crawler@solution.local";

/** Guards against overlapping crawls (cron + manual trigger at the same time). */
let inFlight = false;

/** 确保存在一个系统爬虫账号，抓取的文章挂在该账号下 */
async function ensureCrawlerUser() {
  let user = await prisma.user.findUnique({ where: { email: CRAWLER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "内容爬虫",
        email: CRAWLER_EMAIL,
        role: "USER",
        bio: "自动抓取外部技术文章的系统账号",
      },
    });
  }
  return user;
}

/**
 * 执行 Python 爬虫并把抓取到的文章写入数据库（审核态 draft）。
 *
 * - 按 sourceUrl 去重，已存在的跳过
 * - 所有内容进入审核队列（status="draft"），后台审核通过后才会公开
 * - 每个数据源和整体各写一条 CrawlLog
 *
 * 可在管理后台手动触发，也可由 instrumentation.ts 中的 node-cron 定时调用。
 */
export async function runCrawler(opts: { source?: string; limit?: number } = {}): Promise<CrawlResult> {
  const { source } = opts;
  const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? 5) || 5), 50);

  if (inFlight) {
    return {
      status: "error",
      total: 0,
      added: 0,
      skipped: 0,
      sourcesProcessed: 0,
      message: "已有爬虫任务正在运行",
    };
  }

  inFlight = true;
  try {
    return await runCrawlerUnsafe({ source, limit });
  } finally {
    inFlight = false;
  }
}

async function runCrawlerUnsafe({ source, limit }: { source?: string; limit: number }): Promise<CrawlResult> {
  let stdout: string;
  try {
    // Never interpolate user input into a shell command: pass an explicit
    // argument vector to execFile and validate the source against the
    // whitelist that crawler/main.py actually understands.
    const args = ["-m", "crawler.main"];
    if (source) {
      if (!isCrawlerSource(source)) {
        await prisma.crawlLog.create({
          data: {
            sourceId: source,
            sourceName: source,
            status: "error",
            message: `未知的数据源: ${source}`,
          },
        });
        return {
          status: "error",
          total: 0,
          added: 0,
          skipped: 0,
          sourcesProcessed: 0,
          message: `未知的数据源: ${source}`,
        };
      }
      args.push("--source", source);
    }
    args.push("--limit", String(limit));

    // Alpine's python3 package does not provide a bare `python` binary, while
    // the Windows launcher usually has no `python3`.
    const pythonBin =
      process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

    const { stdout: out } = await execFileAsync(pythonBin, args, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
      cwd: process.cwd(),
    });
    stdout = out;
  } catch (err: any) {
    // Log the failure so it shows up in the admin panel
    await prisma.crawlLog.create({
      data: {
        sourceId: source || "crawler-all",
        sourceName: source || "全部数据源",
        status: "error",
        itemsFound: 0,
        itemsAdded: 0,
        message: `爬虫执行失败: ${err?.message?.slice(0, 200) || "未知错误"}`,
      },
    });
    return {
      status: "error",
      total: 0,
      added: 0,
      skipped: 0,
      sourcesProcessed: 0,
      message: "爬虫任务执行失败",
    };
  }

  // Parse JSON output, don't leak raw stdout
  let result: CrawlerRunOutput;
  try {
    result = JSON.parse(stdout);
  } catch {
    result = { status: "error", articles: [] };
  }

  const articles = result.articles ?? [];
  const crawlerUser = await ensureCrawlerUser();
  let added = 0;
  let skipped = 0;

  for (const item of articles) {
    const sourceUrl = (item.source_url || "").trim();
    const title = (item.title || "").trim().slice(0, 200);

    if (!sourceUrl || !title) {
      skipped++;
      continue;
    }

    const existing = await prisma.article.findFirst({ where: { sourceUrl } });
    if (existing) {
      skipped++;
      continue;
    }

    const content = (item.content || title).slice(0, 100000);
    const tags = await resolveTags(item.tags ?? []);
    // Crawler sources emit their own categories ("tech"); map them onto the
    // categories the site actually understands instead of discarding them.
    const CATEGORY_MAP: Record<string, string> = {
      tech: "news",
      news: "news",
      solution: "solution",
      tutorial: "tutorial",
      guide: "guide",
      reference: "reference",
    };
    const category = CATEGORY_MAP[(item.category || "").toLowerCase()] ?? "news";

    try {
      await prisma.article.create({
        data: {
          title,
          slug: generateSlug(),
          content,
          excerpt: content.replace(/<[^>]*>/g, "").slice(0, 200),
          category,
          status: "draft", // 审核队列：后台审核通过后才会公开
          source: "crawled",
          sourceUrl,
          authorId: crawlerUser.id,
          tags: {
            connectOrCreate: tags.map((t) => ({
              where: { slug: t.slug },
              create: { name: t.name, slug: t.slug },
            })),
          },
        },
      });
      await bumpTagUsage(tags.map((t) => t.slug), 1);
      added++;
    } catch (err: any) {
      skipped++;
      console.error("Crawler ingest failed for", sourceUrl, err?.message);
    }
  }

  // Per-source logs
  for (const r of result.results ?? []) {
    await prisma.crawlLog.create({
      data: {
        sourceId: r.source,
        sourceName: r.source,
        status: r.status === "ok" ? "success" : "error",
        itemsFound: r.count || 0,
        itemsAdded: 0,
        message: r.status === "ok" ? "抓取完成" : "抓取失败",
      },
    });
  }

  // Overall log entry
  await prisma.crawlLog.create({
    data: {
      sourceId: source || "crawler-all",
      sourceName: source || "全部数据源",
      status: added > 0 || result.status === "success" ? "success" : "error",
      itemsFound: articles.length,
      itemsAdded: added,
      message: `新增 ${added} 篇，跳过 ${skipped} 篇（已存在或无效）`,
    },
  });

  return {
    status: result.status === "success" ? "success" : "error",
    total: articles.length,
    added,
    skipped,
    sourcesProcessed: result.sources_processed ?? (source ? 1 : 0),
    message: `爬取完成：新增 ${added} 篇，跳过 ${skipped} 篇`,
  };
}
