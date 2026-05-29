type Bucket = { count: number; resetAt: number };

const globalBuckets = "__ftprRateLimitBuckets" as const;
type G = typeof globalThis & { [globalBuckets]?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  const g = globalThis as G;
  if (!g[globalBuckets]) g[globalBuckets] = new Map();
  return g[globalBuckets]!;
}

/**
 * Fixed window rate limit. Returns { ok: true } or { ok: false, retryAfterSec }.
 * Suitable for login brute-force mitigation (in-memory per server instance).
 */
export function checkRateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const m = buckets();
  const cur = m.get(key);
  if (!cur || now >= cur.resetAt) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  cur.count += 1;
  return { ok: true };
}
