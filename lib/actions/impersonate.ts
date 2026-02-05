"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setImpersonatedClientId, getImpersonatedClientId } from "@/lib/impersonate";

export async function startImpersonation(clientId: string) {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Not authorized" };
  }

  // Verify client exists
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("id", clientId)
    .single();

  if (!client) {
    return { success: false, error: "Client not found" };
  }

  await setImpersonatedClientId(clientId);
  revalidatePath("/", "layout");

  return { success: true, clientName: client.business_name };
}

export async function stopImpersonation() {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Not authorized" };
  }

  await setImpersonatedClientId(null);
  revalidatePath("/", "layout");

  return { success: true };
}

export async function getImpersonationStatus() {
  const supabase = await createClient();

  const clientId = await getImpersonatedClientId();
  if (!clientId) return null;

  // Verify user is still admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    await setImpersonatedClientId(null);
    return null;
  }

  // Get client name
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("id", clientId)
    .single();

  if (!client) {
    await setImpersonatedClientId(null);
    return null;
  }

  return {
    clientId: client.id,
    clientName: client.business_name,
  };
}
