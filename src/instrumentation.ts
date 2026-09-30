/**
 * Next.js instrumentation: runs once when the server starts.
 * Registers a node-cron scheduled crawl using CRAWLER_INTERVAL_HOURS
 * (default 24h). Only active in production to avoid repeated registration
 * during `next dev` hot reloads.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { default: cron } = await import("node-cron");
  const { runCrawler } = await import("@/lib/crawler-ingest");

  // node-cron rejects intervals above 23 (`0 */100 * * *` is invalid and would
  // throw during startup), and 0 would schedule nothing.
  const hours = Math.min(
    23,
    Math.max(1, parseInt(process.env.CRAWLER_INTERVAL_HOURS || "24", 10) || 24)
  );
  const cronExpr = `0 */${hours} * * *`; // every N hours at minute 0

  cron.schedule(cronExpr, () => {
    runCrawler()
      .then((r) => console.log("[crawler] scheduled run:", r.message))
      .catch((e) => console.error("[crawler] scheduled run failed:", e));
  });

  console.log(`[crawler] scheduled every ${hours}h (${cronExpr})`);
}
