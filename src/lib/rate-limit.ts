const rateStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions = {}): { allowed: boolean; remaining: number } {
  const { windowMs = 60000, maxRequests = 10 } = options;
  const now = Date.now();
  let entry = rateStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    rateStore.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Whether `X-Forwarded-For` may be trusted.
 *
 * The header is client-controlled unless a reverse proxy overwrites/appends it,
 * so trusting it by default let anyone mint a fresh rate-limit bucket per request
 * (login brute force, unlimited registration/comments/uploads) — and, conversely,
 * every header-less request shared one `unknown` bucket that a single client
 * could exhaust for everybody. Deployments behind nginx must set `TRUST_PROXY=1`.
 */
export const TRUST_PROXY = process.env.TRUST_PROXY === "1";

/**
 * Client IP for rate limiting and audit records.
 *
 * With a trusted proxy the **last** hop is used: nginx appends the peer address
 * (`$proxy_add_x_forwarded_for`), while anything the client sent stays to its
 * left. Without one, no IP is available to a route handler, so callers fall back
 * to a per-suffix bucket instead of a per-IP one.
 */
export function getClientIp(req: Request): string | null {
  if (!TRUST_PROXY) return null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

export function getRateLimitKey(req: Request, suffix: string): string {
  const ip = getClientIp(req);
  // No trustworthy IP (direct connection): the caller-specific part of `suffix`
  // still separates buckets (e.g. `login:<email>`), it is just not per-IP.
  return ip ? `ip:${ip}:${suffix}` : `direct:${suffix}`;
}

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateStore) {
      if (now > entry.resetAt) rateStore.delete(key);
    }
  }, 60000);
}
