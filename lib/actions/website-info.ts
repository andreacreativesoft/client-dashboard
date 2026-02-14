"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { WebsiteInfo } from "@/types/database";

export type WebsiteInfoFormData = {
  label: string;
  value: string;
  is_sensitive: boolean;
};

export async function getWebsiteInfo(websiteId: string): Promise<WebsiteInfo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_info")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: true })
    .returns<WebsiteInfo[]>();

  if (error) {
    console.error("Error fetching website info:", error);
    return [];
  }

  return data || [];
}

export async function addWebsiteInfoAction(
  websiteId: string,
  formData: WebsiteInfoFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get client_id for revalidation
  const { data: website } = await supabase
    .from("websites")
    .select("client_id")
    .eq("id", websiteId)
    .single<{ client_id: string }>();

  const { error } = await supabase.from("website_info").insert({
    website_id: websiteId,
    label: formData.label,
    value: formData.value,
    is_sensitive: formData.is_sensitive,
  });

  if (error) {
    console.error("Error adding website info:", error);
    return { success: false, error: error.message };
  }

  if (website) {
    revalidatePath(`/admin/clients/${website.client_id}`);
  }
  return { success: true };
}

export async function updateWebsiteInfoAction(
  id: string,
  formData: WebsiteInfoFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("website_info")
    .update({
      label: formData.label,
      value: formData.value,
      is_sensitive: formData.is_sensitive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating website info:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteWebsiteInfoAction(
  id: string,
  websiteId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get client_id for revalidation
  const { data: website } = await supabase
    .from("websites")
    .select("client_id")
    .eq("id", websiteId)
    .single<{ client_id: string }>();

  const { error } = await supabase
    .from("website_info")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting website info:", error);
    return { success: false, error: error.message };
  }

  if (website) {
    revalidatePath(`/admin/clients/${website.client_id}`);
  }
  return { success: true };
}
