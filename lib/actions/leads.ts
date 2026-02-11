"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type PaginatedLeads = {
  leads: LeadWithDetails[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

// Type with denormalized client_id and joined relations
type LeadWithRelations = Lead & {
  website: { id: string; name: string; url: string } | null;
  client: { id: string; business_name: string } | null;
};

/** Apply common Supabase filters to a leads query */
function applyLeadQueryFilters<T extends { eq: (col: string, val: string) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  filters?: LeadFilters,
  clientId?: string | null
): T {
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.websiteId) {
    query = query.eq("website_id", filters.websiteId);
  }
  // Push client_id filter to DB when possible (impersonation or explicit filter)
  if (clientId) {
    query = query.eq("client_id", clientId);
  } else if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }
  return query;
}

/** Transform raw Supabase rows into LeadWithDetails, applying access + search filters */
function transformLeadRows(
  data: LeadWithRelations[],
  opts: {
    isAdmin: boolean;
    userClientIds: string[];
    impersonatedClientId: string | null;
    filters?: LeadFilters;
  }
): LeadWithDetails[] {
  const leads: LeadWithDetails[] = [];

  for (const item of data) {
    const { website, client } = item;
    if (!website || !client) continue;

    // Filter by client if specified (using denormalized client_id)
    if (opts.filters?.clientId && item.client_id !== opts.filters.clientId) {
      continue;
    }

    // When impersonating, only show that client's leads
    if (opts.impersonatedClientId && item.client_id !== opts.impersonatedClientId) {
      continue;
    }

    // Non-admins can only see their clients' leads
    if (!opts.isAdmin && !opts.userClientIds.includes(item.client_id)) {
      continue;
    }

    // Search filter
    if (opts.filters?.search) {
      const searchLower = opts.filters.search.toLowerCase();
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
      client_id: item.client_id,
    });
  }

  return leads;
}

/** Get user's accessible client IDs (for non-admin users) */
async function getUserClientIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("user_id", userId);

  if (!clientUsers) return [];
  return (clientUsers as { client_id: string }[]).map((cu) => cu.client_id);
}

export async function getLeads(filters?: LeadFilters): Promise<LeadWithDetails[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  let query = supabase
    .from("leads")
    .select(`
      *,
      website:websites!website_id(id, name, url),
      client:clients!client_id(id, business_name)
    `)
    .order("created_at", { ascending: false });

  query = applyLeadQueryFilters(query, filters, impersonatedClientId);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching leads:", error.message, error.code, error.details, error.hint);
    return [];
  }

  const userClientIds = !isAdmin ? await getUserClientIds(supabase, profile.id) : [];

  return transformLeadRows((data || []) as LeadWithRelations[], {
    isAdmin,
    userClientIds,
    impersonatedClientId,
    filters,
  });
}

export async function getLeadsPaginated(
  filters?: LeadFilters,
  page = 1,
  perPage = 25
): Promise<PaginatedLeads> {
  const empty: PaginatedLeads = { leads: [], total: 0, page, perPage, totalPages: 0 };

  const profile = await getProfile();
  if (!profile) return empty;

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  // For non-admin users, get their client IDs first
  const userClientIds = !isAdmin ? await getUserClientIds(supabase, profile.id) : [];

  // Determine the effective client_id filter to push to DB
  let effectiveClientId: string | null = impersonatedClientId;
  if (!effectiveClientId && filters?.clientId) {
    effectiveClientId = filters.clientId;
  }
  // For non-admin users with a single client, push it to DB too
  if (!isAdmin && !effectiveClientId && userClientIds.length === 1) {
    effectiveClientId = userClientIds[0]!;
  }

  // Count query (runs in parallel with data query)
  let countQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true });
  countQuery = applyLeadQueryFilters(countQuery, filters, effectiveClientId);

  // Data query with pagination
  const offset = (page - 1) * perPage;
  let dataQuery = supabase
    .from("leads")
    .select(`
      *,
      website:websites!website_id(id, name, url),
      client:clients!client_id(id, business_name)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);
  dataQuery = applyLeadQueryFilters(dataQuery, filters, effectiveClientId);

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  if (dataResult.error) {
    console.error("Error fetching paginated leads:", dataResult.error.message);
    return empty;
  }

  const total = countResult.count ?? 0;
  const leads = transformLeadRows((dataResult.data || []) as LeadWithRelations[], {
    isAdmin,
    userClientIds,
    impersonatedClientId,
    filters,
  });

  return {
    leads,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getLead(id: string): Promise<LeadWithDetails | null> {
  const supabase = await createClient();

  // Uses denormalized client_id — explicit FK hints to avoid PostgREST ambiguity
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      website:websites!website_id(id, name, url),
      client:clients!client_id(id, business_name)
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

export async function getLeadCountForClient(clientId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (error) {
    console.error("Error fetching lead count:", error);
    return 0;
  }

  return count || 0;
}
