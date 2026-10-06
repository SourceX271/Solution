/**
 * Next.js instrumentation: runs once when the server starts.
 *
 * Node-only work lives in `@/lib/crawler-scheduler` and is imported *inside* the
 * runtime check. That placement matters: Next.js compiles this file for both the
 * Node.js and the Edge runtime whenever the app has Edge middleware (next-intl
 * here), and webpack only drops a dynamic import when it sits in the dead branch
 * of the `if` — an early `return` followed by top-level imports is still bundled
 * for Edge and fails on `child_process` / `node:crypto`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerCrawlerSchedule } = await import("@/lib/crawler-scheduler");
    await registerCrawlerSchedule();
  }
}
