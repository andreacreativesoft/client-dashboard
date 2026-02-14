"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Website } from "@/types/database";

export type WebsiteFormData = {
  name: string;
  url: string;
  source_type: string;
  git_repo_url?: string;
};

function generateApiKey(): string {
  return "wh_" + randomBytes(24).toString("base64url");
}

function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("base64url");
}

export async function getWebsitesForClient(clientId: string): Promise<Website[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("websites")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<Website[]>();

  if (error) {
    console.error("Error fetching websites:", error);
    return [];
  }

  return data || [];
}

export async function createWebsiteAction(
  clientId: string,
  formData: WebsiteFormData
): Promise<{ success: boolean; error?: string; website?: Website }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const apiKey = generateApiKey();
  const webhookSecret = generateWebhookSecret();

  const { data, error } = await supabase
    .from("websites")
    .insert({
      client_id: clientId,
      name: formData.name,
      url: formData.url,
      source_type: formData.source_type || "elementor",
      git_repo_url: formData.git_repo_url || null,
      api_key: apiKey,
      webhook_secret: webhookSecret,
      is_active: true,
    })
    .select()
    .single<Website>();

  if (error) {
    console.error("Error creating website:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/websites");
  return { success: true, website: data };
}

export async function updateWebsiteAction(
  id: string,
  formData: WebsiteFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { data: website } = await supabase
    .from("websites")
    .select("client_id")
    .eq("id", id)
    .single<{ client_id: string }>();

  const { error } = await supabase
    .from("websites")
    .update({
      name: formData.name,
      url: formData.url,
      source_type: formData.source_type,
      git_repo_url: formData.git_repo_url || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating website:", error);
    return { success: false, error: error.message };
  }

  if (website) {
    revalidatePath(`/admin/clients/${website.client_id}`);
  }
  revalidatePath("/admin/websites");
  return { success: true };
}

export async function deleteWebsiteAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { data: website } = await supabase
    .from("websites")
    .select("client_id")
    .eq("id", id)
    .single<{ client_id: string }>();

  const { error } = await supabase.from("websites").delete().eq("id", id);

  if (error) {
    console.error("Error deleting website:", error);
    return { success: false, error: error.message };
  }

  if (website) {
    revalidatePath(`/admin/clients/${website.client_id}`);
  }
  revalidatePath("/admin/websites");
  return { success: true };
}

export async function toggleWebsiteActiveAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("websites")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Error toggling website:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/websites");
  return { success: true };
}

export async function regenerateApiKeyAction(
  id: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const newApiKey = generateApiKey();

  const { error } = await supabase
    .from("websites")
    .update({ api_key: newApiKey })
    .eq("id", id);

  if (error) {
    console.error("Error regenerating API key:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/websites");
  return { success: true, apiKey: newApiKey };
}
