/**
 * Best-effort in-memory rate limiter (token bucket per client key).
 *
 * Limitation: state lives in a single process. On serverless/multi-instance
 * deployments each instance keeps its own buckets, so this is a guardrail
 * against bursts and accidental abuse — not a hard global quota. Swap the
 * store for Redis/Upstash if you need cross-instance enforcement.
 */

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next token is available (0 when allowed). */
  retryAfter: number;
};

const DEFAULT_CAPACITY = 10;
const DEFAULT_REFILL_PER_SEC = 10 / 60; // 10 requests per minute

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export function rateLimit(
  key: string,
  capacity = DEFAULT_CAPACITY,
  refillPerSec = DEFAULT_REFILL_PER_SEC
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: capacity, updatedAt: now };

  // Refill based on elapsed time.
  const elapsedSec = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.updatedAt = now;

  let allowed = false;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    allowed = true;
  }

  // Bound memory: drop the oldest entries if the map grows unbounded.
  if (!existing && buckets.size >= MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
  buckets.set(key, bucket);

  const retryAfter = allowed ? 0 : Math.ceil((1 - bucket.tokens) / refillPerSec);
  return { allowed, remaining: Math.floor(bucket.tokens), retryAfter };
}

/** Derive a client key from forwarded headers, falling back to a constant. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Test helper: clear all buckets. */
export function __resetRateLimit(): void {
  buckets.clear();
}
