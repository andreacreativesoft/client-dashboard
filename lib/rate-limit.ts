/**
 * Production rate limiter using Upstash Redis.
 * Falls back to in-memory when Redis is not configured (dev/local).
 *
 * Persists across serverless cold starts and Vercel deployments.
 * Free tier: 10,000 requests/day — more than enough for rate limit checks.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Types ────────────────────────────────────────────────────────────

interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── Redis client (singleton) ─────────────────────────────────────────

const hasRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ─── Limiter cache (one per unique window config) ─────────────────────

const limiterCache = new Map<string, Ratelimit>();

function getOrCreateLimiter(options: RateLimitOptions): Ratelimit {
  const cacheKey = `${options.windowMs}:${options.maxRequests}`;
  let limiter = limiterCache.get(cacheKey);

  if (!limiter) {
    const windowSec = Math.ceil(options.windowMs / 1000);
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(options.maxRequests, `${windowSec} s`),
      prefix: "rl",
      analytics: true,
    });
    limiterCache.set(cacheKey, limiter);
  }

  return limiter;
}

// ─── In-memory fallback (dev/local without Redis) ─────────────────────

interface MemoryEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, MemoryEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function memoryCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of memoryStore) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  }
}

function memoryRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests } = options;

  memoryCleanup(windowMs);

  const cutoff = now - windowMs;
  let entry = memoryStore.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Rate limit a request by key.
 * Uses Upstash Redis in production, falls back to in-memory for local dev.
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  // Fallback to in-memory if Redis not configured
  if (!redis) {
    return memoryRateLimit(key, options);
  }

  try {
    const limiter = getOrCreateLimiter(options);
    const result = await limiter.limit(key);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  } catch (err) {
    // If Redis fails, fall back to in-memory (don't block the request)
    console.error("Redis rate limit error, falling back to memory:", err instanceof Error ? err.message : err);
    return memoryRateLimit(key, options);
  }
}

// ─── Helper: get IP from request ──────────────────────────────────────

export function getIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return "unknown";
}
