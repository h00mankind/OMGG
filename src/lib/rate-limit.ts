const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;

// In-memory per-process sliding window. On serverless each cold-started
// instance gets its own Map, so this is a best-effort throttle — for hard
// guarantees move to Vercel KV / Upstash.
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const bucket = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (bucket.length >= MAX_PER_WINDOW) {
    const oldest = bucket[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    hits.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec };
  }

  bucket.push(now);
  hits.set(key, bucket);

  if (hits.size > 5000) {
    for (const [k, arr] of hits) {
      if (arr.every((t) => t <= cutoff)) hits.delete(k);
    }
  }

  return { ok: true, remaining: MAX_PER_WINDOW - bucket.length, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
