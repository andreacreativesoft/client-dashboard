"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/google";
import type { IntegrationType } from "@/types/database";

export async function addFacebookIntegration(
  clientId: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Not authorized" };
  }

  // Encrypt the access token
  const encryptedToken = encryptToken(accessToken);

  // Upsert integration
  const { error } = await supabase.from("integrations").upsert(
    {
      client_id: clientId,
      type: "facebook" as IntegrationType,
      account_id: pixelId,
      account_name: `Pixel ${pixelId}`,
      access_token_encrypted: encryptedToken,
      refresh_token_encrypted: null,
      token_expires_at: null,
      metadata: testEventCode ? { test_event_code: testEventCode } : {},
      is_active: true,
    },
    {
      onConflict: "client_id,type,account_id",
    }
  );

  if (error) {
    console.error("Failed to save Facebook integration:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function deleteIntegration(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", integrationId);

  if (error) {
    console.error("Failed to delete integration:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/integrations");
  return { success: true };
}
