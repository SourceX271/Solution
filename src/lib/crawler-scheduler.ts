/**
 * Node.js-only server bootstrap.
 *
 * This module must never be reachable from an Edge context: it pulls in
 * `node-cron` and `@/lib/crawler-ingest` (which spawns the Python crawler via
 * `child_process`). It is loaded dynamically from `src/instrumentation.ts`
 * exclusively inside the `NEXT_RUNTIME === "nodejs"` branch.
 */
export async function registerCrawlerSchedule(): Promise<void> {
  // Only active in production to avoid repeated registration during `next dev`
  // hot reloads.
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
