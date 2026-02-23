"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/google";
import type { AdminSetting } from "@/types/database";

// ─── Known setting keys ─────────────────────────────────────────────────
export const SETTING_KEYS = {
  ANTHROPIC_API_KEY: "anthropic_api_key",
  AI_ENABLED: "ai_enabled",
  AI_MODEL: "ai_model",
  AI_READ_TOOLS_ENABLED: "ai_read_tools_enabled",
  AI_WRITE_TOOLS_ENABLED: "ai_write_tools_enabled",
  AI_DELETE_TOOLS_ENABLED: "ai_delete_tools_enabled",
  AI_WOOCOMMERCE_TOOLS_ENABLED: "ai_woocommerce_tools_enabled",
  AI_USER_MANAGEMENT_ENABLED: "ai_user_management_enabled",
} as const;

// Keys that contain sensitive values and should be encrypted
const ENCRYPTED_KEYS: Set<string> = new Set([SETTING_KEYS.ANTHROPIC_API_KEY]);

// ─── Get a single setting ────────────────────────────────────────────────
export async function getAdminSetting(key: string): Promise<string | null> {
  const auth = await requireAdmin();
  if (!auth.success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_settings")
    .select("value, is_encrypted")
    .eq("key", key)
    .single();

  if (!data) return null;
  return data.is_encrypted ? decryptToken(data.value) : data.value;
}

// ─── Get all settings ────────────────────────────────────────────────────
export async function getAdminSettings(): Promise<Record<string, string>> {
  const auth = await requireAdmin();
  if (!auth.success) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_settings")
    .select("key, value, is_encrypted")
    .returns<Pick<AdminSetting, "key" | "value" | "is_encrypted">[]>();

  if (!data) return {};

  const settings: Record<string, string> = {};
  for (const row of data) {
    // For encrypted values, show a masked version in the UI
    if (row.is_encrypted && row.value) {
      const decrypted = decryptToken(row.value);
      settings[row.key] = decrypted;
    } else {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// ─── Upsert a setting ────────────────────────────────────────────────────
export async function updateAdminSetting(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const shouldEncrypt = ENCRYPTED_KEYS.has(key);
  const storedValue = shouldEncrypt && value ? encryptToken(value) : value;

  const supabase = await createClient();

  // Check if setting exists
  const { data: existing } = await supabase
    .from("admin_settings")
    .select("id")
    .eq("key", key)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("admin_settings")
      .update({
        value: storedValue,
        is_encrypted: shouldEncrypt,
        updated_by: auth.userId,
      })
      .eq("key", key);

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("admin_settings")
      .insert({
        key,
        value: storedValue,
        is_encrypted: shouldEncrypt,
        updated_by: auth.userId,
      });

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── Get API key for server-side use (DB first, then env fallback) ───────
// This function does NOT require admin auth — it's for internal server use.
export async function getAnthropicApiKey(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("admin_settings")
      .select("value, is_encrypted")
      .eq("key", SETTING_KEYS.ANTHROPIC_API_KEY)
      .single();

    if (data?.value) {
      return data.is_encrypted ? decryptToken(data.value) : data.value;
    }
  } catch {
    // Fall through to env var
  }

  return process.env.ANTHROPIC_API_KEY || null;
}
