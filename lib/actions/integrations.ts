"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { encryptToken } from "@/lib/google";
import type { Integration, IntegrationType } from "@/types/database";

export async function getIntegrationsForClient(
  clientId: string
): Promise<Integration[]> {
  const auth = await requireAdmin();
  if (!auth.success) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch integrations:", error);
    return [];
  }

  return (data || []) as Integration[];
}

export async function addFacebookIntegration(
  clientId: string,
  pixelId: string,
  accessToken: string,
  testEventCode?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

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

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function selectIntegrationAccount(
  integrationId: string,
  accountId: string,
  accountName: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get current integration to update metadata
  const { data: integration, error: fetchError } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("id", integrationId)
    .single();

  if (fetchError || !integration) {
    return { success: false, error: "Integration not found" };
  }

  // Remove selection flags from metadata, keep the rest
  const metadata = (integration.metadata || {}) as Record<string, unknown>;
  delete metadata.needsPropertySelection;
  delete metadata.needsLocationSelection;

  const { error } = await supabase
    .from("integrations")
    .update({
      account_id: accountId,
      account_name: accountName,
      metadata,
    })
    .eq("id", integrationId);

  if (error) {
    console.error("Failed to select integration account:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function deleteIntegration(
  integrationId: string,
  clientId?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", integrationId);

  if (error) {
    console.error("Failed to delete integration:", error);
    return { success: false, error: error.message };
  }

  if (clientId) {
    revalidatePath(`/admin/clients/${clientId}`);
  }
  return { success: true };
}
