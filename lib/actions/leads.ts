"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getImpersonatedClientId } from "@/lib/impersonate";
import type { Lead, LeadStatus } from "@/types/database";

export type LeadWithDetails = Lead & {
  website_name: string;
  website_url: string;
  client_name: string;
  // client_id is already on Lead (denormalized)
};

export type LeadFilters = {
  status?: LeadStatus | "all";
  websiteId?: string;
  clientId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getLeads(filters?: LeadFilters): Promise<LeadWithDetails[]> {
  const supabase = await createClient();

  // First check if user is admin to determine what leads they can see
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const isAdmin = profile?.role === "admin";

  // Check if admin is impersonating a client
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  // Build query - uses denormalized client_id for filtering
  // Still joins website for name/url, and client for business_name
  let query = supabase
    .from("leads")
    .select(`
      *,
      website:websites(id, name, url),
      client:clients(id, business_name)
    `)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.websiteId) {
    query = query.eq("website_id", filters.websiteId);
  }

  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching leads:", error);
    return [];
  }

  // Transform and filter based on client access
  const leads: LeadWithDetails[] = [];

  // If not admin, get user's client IDs (for additional filtering if RLS not applied)
  let userClientIds: string[] = [];
  if (!isAdmin) {
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", user.id)
      .returns<{ client_id: string }[]>();

    userClientIds = clientUsers?.map((cu) => cu.client_id) || [];
  }

  // Type with denormalized client_id and joined relations
  type LeadWithRelations = Lead & {
    website: { id: string; name: string; url: string } | null;
    client: { id: string; business_name: string } | null;
  };

  for (const item of (data || []) as LeadWithRelations[]) {
    const { website, client } = item;

    if (!website || !client) continue;

    // Filter by client if specified (using denormalized client_id)
    if (filters?.clientId && item.client_id !== filters.clientId) {
      continue;
    }

    // When impersonating, only show that client's leads
    if (impersonatedClientId && item.client_id !== impersonatedClientId) {
      continue;
    }

    // Non-admins can only see their clients' leads
    if (!isAdmin && !userClientIds.includes(item.client_id)) {
      continue;
    }

    // Search filter
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        item.name?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower) ||
        item.phone?.toLowerCase().includes(searchLower) ||
        item.message?.toLowerCase().includes(searchLower);

      if (!matchesSearch) continue;
    }

    leads.push({
      ...item,
      website_name: website.name,
      website_url: website.url,
      client_name: client.business_name,
      client_id: item.client_id, // Use denormalized client_id
    });
  }

  return leads;
}

export async function getLead(id: string): Promise<LeadWithDetails | null> {
  const supabase = await createClient();

  // Uses denormalized client_id - no 3-table join needed
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      website:websites(id, name, url),
      client:clients(id, business_name)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching lead:", error);
    return null;
  }

  type LeadWithRelations = Lead & {
    website: { id: string; name: string; url: string } | null;
    client: { id: string; business_name: string } | null;
  };

  const typedData = data as LeadWithRelations;
  const { website, client } = typedData;

  if (!website || !client) return null;

  return {
    ...typedData,
    website_name: website.name,
    website_url: website.url,
    client_name: client.business_name,
    client_id: typedData.client_id,
  };
}

export async function updateLeadStatusAction(
  id: string,
  status: LeadStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating lead status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { success: true };
}

export async function deleteLeadAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    console.error("Error deleting lead:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/leads");
  return { success: true };
}

// Lead notes
export type LeadNoteWithUser = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string;
};

export async function getLeadNotes(leadId: string): Promise<LeadNoteWithUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_notes")
    .select(`
      *,
      profile:profiles(full_name)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching lead notes:", error);
    return [];
  }

  type NoteWithProfile = {
    id: string;
    lead_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profile: { full_name: string } | null;
  };

  return ((data || []) as NoteWithProfile[]).map((note) => ({
    id: note.id,
    lead_id: note.lead_id,
    user_id: note.user_id,
    content: note.content,
    created_at: note.created_at,
    user_name: note.profile?.full_name || "Unknown",
  }));
}

export async function addLeadNoteAction(
  leadId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    user_id: user.id,
    content,
  });

  if (error) {
    console.error("Error adding lead note:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}
