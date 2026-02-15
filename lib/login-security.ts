/**
 * Login security module.
 *
 * Features:
 * 1. reCAPTCHA v3 verification (server-side)
 * 2. Login attempt limiting:
 *    - 3 failed attempts → 30 min pause
 *    - 3 more failures after pause → account blocked
 * 3. Forgot-password rate limiting: 1 request per 15 min
 *
 * Uses Upstash Redis for persistent tracking across serverless cold starts.
 * Falls back to in-memory when Redis is not configured (dev).
 */

import { Redis } from "@upstash/redis";
import { createAdminClient } from "@/lib/supabase/admin";

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

// ─── In-memory fallback for dev ───────────────────────────────────────

const memoryStore = new Map<string, { count: number; firstAttempt: number; phase: number }>();
const memoryResetStore = new Map<string, number>(); // email → last reset request time

// ─── Constants ────────────────────────────────────────────────────────

const LOGIN_MAX_ATTEMPTS_PER_PHASE = 3;
const LOGIN_PAUSE_MS = 30 * 60 * 1000; // 30 minutes
const LOGIN_WINDOW_MS = 30 * 60 * 1000; // 30 min window for counting attempts
const RESET_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const RECAPTCHA_MIN_SCORE = 0.5;

// Redis key prefixes
const LOGIN_KEY = "login_attempts:";
const RESET_KEY = "reset_cooldown:";

// ─── Types ────────────────────────────────────────────────────────────

export interface LoginSecurityResult {
  allowed: boolean;
  blocked?: boolean;
  error?: string;
  waitMinutes?: number;
  waitUntil?: number;
}

export interface ResetSecurityResult {
  allowed: boolean;
  error?: string;
  waitMinutes?: number;
  waitUntil?: number;
}

// ─── reCAPTCHA v3 verification ────────────────────────────────────────

export async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    // If no reCAPTCHA configured, allow through (dev mode)
    console.warn("reCAPTCHA secret key not configured, skipping verification");
    return true;
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json() as {
      success: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };

    if (!data.success) {
      console.warn("reCAPTCHA verification failed:", data["error-codes"]);
      return false;
    }

    // v3 returns a score (0.0 - 1.0), higher is more likely human
    if (data.score !== undefined && data.score < RECAPTCHA_MIN_SCORE) {
      console.warn(`reCAPTCHA score too low: ${data.score}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    // Fail open on network errors to not lock out users
    return true;
  }
}

// ─── Login attempt tracking ───────────────────────────────────────────

/**
 * Check if a login attempt is allowed for the given email.
 * Must be called BEFORE attempting authentication.
 *
 * Logic:
 * - Phase 1: 3 failed attempts → 30 min pause
 * - Phase 2: 3 more failed attempts after pause → account blocked permanently
 */
export async function checkLoginAttempt(email: string): Promise<LoginSecurityResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if account is blocked in database
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_blocked")
    .eq("email", normalizedEmail)
    .single();

  if (profile?.is_blocked) {
    return {
      allowed: false,
      blocked: true,
      error: "This account has been blocked due to too many failed login attempts. Please contact the administrator to unblock your account.",
    };
  }

  // Check attempt count
  if (redis) {
    return checkLoginAttemptRedis(normalizedEmail);
  }
  return checkLoginAttemptMemory(normalizedEmail);
}

async function checkLoginAttemptRedis(email: string): Promise<LoginSecurityResult> {
  const key = `${LOGIN_KEY}${email}`;

  const data = await redis!.hgetall(key) as {
    count?: string;
    firstAttempt?: string;
    phase?: string;
  } | null;

  if (!data || !data.count) {
    return { allowed: true };
  }

  const count = parseInt(data.count, 10);
  const firstAttempt = parseInt(data.firstAttempt || "0", 10);
  const phase = parseInt(data.phase || "1", 10);
  const now = Date.now();

  // If in phase 1 and max attempts reached, check if pause has elapsed
  if (phase === 1 && count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    const pauseEnd = firstAttempt + LOGIN_PAUSE_MS;
    if (now < pauseEnd) {
      const waitMinutes = Math.ceil((pauseEnd - now) / 60000);
      return {
        allowed: false,
        error: `Too many failed login attempts. Please wait ${waitMinutes} minute${waitMinutes !== 1 ? "s" : ""} before trying again.`,
        waitMinutes,
        waitUntil: pauseEnd,
      };
    }
    // Pause has elapsed — move to phase 2, reset count
    await redis!.hset(key, { count: "0", firstAttempt: String(now), phase: "2" });
    await redis!.expire(key, Math.ceil(LOGIN_WINDOW_MS / 1000));
    return { allowed: true };
  }

  // Phase 2: already used up phase 2 attempts → should have been blocked
  if (phase === 2 && count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    // This shouldn't happen because we block after 3 phase-2 failures
    // but handle it just in case
    return {
      allowed: false,
      blocked: true,
      error: "This account has been blocked due to too many failed login attempts. Please contact the administrator to unblock your account.",
    };
  }

  return { allowed: true };
}

function checkLoginAttemptMemory(email: string): LoginSecurityResult {
  const entry = memoryStore.get(email);

  if (!entry) {
    return { allowed: true };
  }

  const now = Date.now();

  if (entry.phase === 1 && entry.count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    const pauseEnd = entry.firstAttempt + LOGIN_PAUSE_MS;
    if (now < pauseEnd) {
      const waitMinutes = Math.ceil((pauseEnd - now) / 60000);
      return {
        allowed: false,
        error: `Too many failed login attempts. Please wait ${waitMinutes} minute${waitMinutes !== 1 ? "s" : ""} before trying again.`,
        waitMinutes,
        waitUntil: pauseEnd,
      };
    }
    // Pause elapsed, move to phase 2
    entry.count = 0;
    entry.firstAttempt = now;
    entry.phase = 2;
    return { allowed: true };
  }

  if (entry.phase === 2 && entry.count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    return {
      allowed: false,
      blocked: true,
      error: "This account has been blocked due to too many failed login attempts. Please contact the administrator to unblock your account.",
    };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt. Call after auth fails.
 * May block the account if phase 2 attempts are exhausted.
 */
export async function recordFailedLogin(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  if (redis) {
    await recordFailedLoginRedis(normalizedEmail);
  } else {
    recordFailedLoginMemory(normalizedEmail);
  }
}

async function recordFailedLoginRedis(email: string): Promise<void> {
  const key = `${LOGIN_KEY}${email}`;

  const data = await redis!.hgetall(key) as {
    count?: string;
    firstAttempt?: string;
    phase?: string;
  } | null;

  const now = Date.now();
  let count = data?.count ? parseInt(data.count, 10) : 0;
  let firstAttempt = data?.firstAttempt ? parseInt(data.firstAttempt, 10) : now;
  let phase = data?.phase ? parseInt(data.phase, 10) : 1;

  // If no entry exists, initialize
  if (!data || !data.count) {
    firstAttempt = now;
    phase = 1;
    count = 0;
  }

  count += 1;

  await redis!.hset(key, {
    count: String(count),
    firstAttempt: String(firstAttempt),
    phase: String(phase),
  });
  // Auto-expire after window (safety net)
  await redis!.expire(key, Math.ceil((LOGIN_WINDOW_MS * 2) / 1000));

  // If phase 2 and hit the limit → block account in DB
  if (phase === 2 && count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    await blockAccount(email);
  }
}

function recordFailedLoginMemory(email: string): void {
  const now = Date.now();
  let entry = memoryStore.get(email);

  if (!entry) {
    entry = { count: 0, firstAttempt: now, phase: 1 };
    memoryStore.set(email, entry);
  }

  entry.count += 1;

  // If phase 2 and hit the limit → block account in DB
  if (entry.phase === 2 && entry.count >= LOGIN_MAX_ATTEMPTS_PER_PHASE) {
    blockAccount(email).catch((err) =>
      console.error("Failed to block account:", err)
    );
  }
}

/**
 * Clear login attempts after a successful login.
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  if (redis) {
    await redis!.del(`${LOGIN_KEY}${normalizedEmail}`);
  } else {
    memoryStore.delete(normalizedEmail);
  }
}

// ─── Account blocking ─────────────────────────────────────────────────

async function blockAccount(email: string): Promise<void> {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ is_blocked: true })
    .eq("email", email);

  if (error) {
    console.error("Failed to block account:", error);
  } else {
    console.warn(`Account blocked due to excessive failed login attempts: ${email}`);
  }
}

/**
 * Unblock an account (admin action).
 */
export async function unblockAccount(email: string): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update({ is_blocked: false })
    .eq("email", normalizedEmail);

  if (error) {
    return { success: false, error: error.message };
  }

  // Clear attempt counters
  await clearLoginAttempts(normalizedEmail);

  return { success: true };
}

// ─── Forgot password rate limiting ────────────────────────────────────

/**
 * Check if a password reset request is allowed (1 per 15 min).
 */
export async function checkResetRateLimit(email: string): Promise<ResetSecurityResult> {
  const normalizedEmail = email.toLowerCase().trim();

  if (redis) {
    return checkResetRateLimitRedis(normalizedEmail);
  }
  return checkResetRateLimitMemory(normalizedEmail);
}

async function checkResetRateLimitRedis(email: string): Promise<ResetSecurityResult> {
  const key = `${RESET_KEY}${email}`;
  const lastRequest = await redis!.get(key) as string | null;

  if (lastRequest) {
    const lastTime = parseInt(lastRequest, 10);
    const now = Date.now();
    const cooldownEnd = lastTime + RESET_COOLDOWN_MS;

    if (now < cooldownEnd) {
      const waitMinutes = Math.ceil((cooldownEnd - now) / 60000);
      return {
        allowed: false,
        error: `You can only request a password reset once every 15 minutes. Please wait ${waitMinutes} minute${waitMinutes !== 1 ? "s" : ""} before trying again. Check your email inbox and spam folder for the previous reset link.`,
        waitMinutes,
        waitUntil: cooldownEnd,
      };
    }
  }

  // Record this request
  await redis!.set(key, String(Date.now()), { ex: Math.ceil(RESET_COOLDOWN_MS / 1000) });

  return { allowed: true };
}

function checkResetRateLimitMemory(email: string): ResetSecurityResult {
  const lastRequest = memoryResetStore.get(email);
  const now = Date.now();

  if (lastRequest) {
    const cooldownEnd = lastRequest + RESET_COOLDOWN_MS;
    if (now < cooldownEnd) {
      const waitMinutes = Math.ceil((cooldownEnd - now) / 60000);
      return {
        allowed: false,
        error: `You can only request a password reset once every 15 minutes. Please wait ${waitMinutes} minute${waitMinutes !== 1 ? "s" : ""} before trying again. Check your email inbox and spam folder for the previous reset link.`,
        waitMinutes,
        waitUntil: cooldownEnd,
      };
    }
  }

  memoryResetStore.set(email, now);
  return { allowed: true };
}
