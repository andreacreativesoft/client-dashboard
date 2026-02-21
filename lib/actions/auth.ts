"use server";

import { createClient } from "@/lib/supabase/server";
import {
  verifyRecaptcha,
  checkLoginAttempt,
  recordFailedLogin,
  clearLoginAttempts,
  checkResetRateLimit,
} from "@/lib/login-security";

// ─── Types ────────────────────────────────────────────────────────────

interface LoginResult {
  success: boolean;
  error?: string;
  blocked?: boolean;
  waitMinutes?: number;
}

interface ResetResult {
  success: boolean;
  error?: string;
  waitMinutes?: number;
}

// ─── Login action ─────────────────────────────────────────────────────

export async function loginAction(
  email: string,
  password: string,
  recaptchaToken?: string
): Promise<LoginResult> {
  // 1. Verify reCAPTCHA
  if (recaptchaToken) {
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return { success: false, error: "reCAPTCHA verification failed. Please try again." };
    }
  } else if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    // reCAPTCHA is configured but no token provided — suspicious
    return { success: false, error: "Security verification required. Please reload the page and try again." };
  }

  // 2. Check login attempts before authenticating
  const attemptCheck = await checkLoginAttempt(email);
  if (!attemptCheck.allowed) {
    return {
      success: false,
      error: attemptCheck.error,
      blocked: attemptCheck.blocked,
      waitMinutes: attemptCheck.waitMinutes,
    };
  }

  // 3. Authenticate with Supabase
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    // Record failure
    await recordFailedLogin(email);

    // Re-check to see if this failure triggered blocking or pause
    const postCheck = await checkLoginAttempt(email);
    if (!postCheck.allowed) {
      return {
        success: false,
        error: postCheck.error,
        blocked: postCheck.blocked,
        waitMinutes: postCheck.waitMinutes,
      };
    }

    return { success: false, error: "Invalid email or password" };
  }

  // 4. Success — clear attempts
  await clearLoginAttempts(email);

  return { success: true };
}

// ─── Forgot password action ──────────────────────────────────────────

export async function forgotPasswordAction(
  email: string,
  recaptchaToken?: string,
  redirectUrl?: string
): Promise<ResetResult> {
  // 1. Verify reCAPTCHA
  if (recaptchaToken) {
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return { success: false, error: "reCAPTCHA verification failed. Please try again." };
    }
  } else if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    return { success: false, error: "Security verification required. Please reload the page and try again." };
  }

  // 2. Check rate limit (1 per 15 min)
  const rateLimitCheck = await checkResetRateLimit(email);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: rateLimitCheck.error,
      waitMinutes: rateLimitCheck.waitMinutes,
    };
  }

  // 3. Send reset email via Supabase
  const supabase = await createClient();
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/settings`,
    }
  );

  if (resetError) {
    return { success: false, error: resetError.message };
  }

  return { success: true };
}
