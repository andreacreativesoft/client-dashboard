"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { setSelectedClientId } from "@/lib/selected-client";
import type { Client } from "@/types/database";

export type ClientFormData = {
  business_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
};

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Client[]>();

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }

  return data || [];
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single<Client>();

  if (error) {
    console.error("Error fetching client:", error);
    return null;
  }

  return data;
}

export async function createClientAction(
  formData: ClientFormData
): Promise<{ success: boolean; error?: string; client?: Client }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      business_name: formData.business_name,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      notes: formData.notes || null,
      created_by: auth.userId,
    })
    .select()
    .single<Client>();

  if (error) {
    console.error("Error creating client:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/clients");
  return { success: true, client: data };
}

export async function updateClientAction(
  id: string,
  formData: ClientFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      business_name: formData.business_name,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      notes: formData.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating client:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { success: true };
}

export async function deleteClientAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    console.error("Error deleting client:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/clients");
  return { success: true };
}

export async function selectClientAction(
  clientId: string | null
): Promise<{ success: boolean }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false };

  await setSelectedClientId(clientId);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateClientNotesAction(
  id: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ notes: notes || null })
    .eq("id", id);

  if (error) {
    console.error("Error updating client notes:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${id}`);
  return { success: true };
}
