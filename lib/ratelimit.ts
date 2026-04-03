// ============================================================
// RATE LIMITING — Upstash Redis
// Protects AI endpoints and auth from abuse.
// Falls back gracefully if Redis is not configured.
// ============================================================

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazily initialize Redis — app still works without it (dev mode)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ─── Rate Limiters ───────────────────────────────────────────

// AI generation: 10 requests per minute per user (premium)
export const aiRateLimit = createLimiter(10, "1 m");

// AI free preview: 3 per day per user
export const aiPreviewRateLimit = createLimiter(3, "1 d");

// Resume review: 20 per hour per user (increased from 5 for better UX)
export const reviewRateLimit = createLimiter(20, "1 h");

// Auth attempts: 20 per 10 minutes per IP
export const authRateLimit = createLimiter(20, "10 m");

// ─── Helper ──────────────────────────────────────────────────

function createLimiter(requests: number, window: string) {
  const r = getRedis();
  if (!r) return null; // Disabled in local dev without Redis

  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"s" | "m" | "h" | "d"}`),
    analytics: true,
  });
}

/**
 * Checks rate limit for a given key.
 * Returns true if allowed, throws 429 error if rate limited.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<void> {
  if (!limiter) return; // Skip if not configured

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw Object.assign(new Error("RATE_LIMITED"), {
      retryAfter,
      limit,
      remaining,
    });
  }
}