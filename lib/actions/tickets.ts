"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile";
import { requireAdmin } from "@/lib/auth";
import { getImpersonatedClientId } from "@/lib/impersonate";
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketWithDetails,
  TicketReplyWithUser,
} from "@/types/database";

export type TicketFilters = {
  status?: TicketStatus | "all";
  priority?: TicketPriority | "all";
  category?: TicketCategory | "all";
  clientId?: string;
  search?: string;
};

export type PaginatedTickets = {
  tickets: TicketWithDetails[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type CreateTicketData = {
  client_id: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigned_to?: string | null;
  due_date?: string | null;
};

// Raw row shape from Supabase join query
type TicketRow = Ticket & {
  client: { business_name: string } | null;
  creator: { full_name: string } | null;
  assignee: { full_name: string } | null;
  ticket_replies: { count: number }[];
};

function transformTicketRow(row: TicketRow): TicketWithDetails {
  return {
    ...row,
    client_name: row.client?.business_name ?? "Unknown",
    created_by_name: row.creator?.full_name ?? "Unknown",
    assigned_to_name: row.assignee?.full_name ?? null,
    reply_count: row.ticket_replies?.[0]?.count ?? 0,
  };
}

export async function getTicketsPaginated(
  filters?: TicketFilters,
  page = 1,
  perPage = 25
): Promise<PaginatedTickets> {
  const empty: PaginatedTickets = { tickets: [], total: 0, page, perPage, totalPages: 0 };

  const profile = await getProfile();
  if (!profile) return empty;

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  // Build base filter params
  const effectiveClientId = impersonatedClientId || filters?.clientId || null;

  // Count query
  let countQuery = supabase
    .from("tickets")
    .select("id", { count: "exact", head: true });

  if (filters?.status && filters.status !== "all") {
    countQuery = countQuery.eq("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    countQuery = countQuery.eq("priority", filters.priority);
  }
  if (filters?.category && filters.category !== "all") {
    countQuery = countQuery.eq("category", filters.category);
  }
  if (effectiveClientId) {
    countQuery = countQuery.eq("client_id", effectiveClientId);
  }

  // Data query
  const offset = (page - 1) * perPage;
  let dataQuery = supabase
    .from("tickets")
    .select(`
      *,
      client:clients!client_id(business_name),
      creator:profiles!created_by(full_name),
      assignee:profiles!assigned_to(full_name),
      ticket_replies(count)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (filters?.status && filters.status !== "all") {
    dataQuery = dataQuery.eq("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    dataQuery = dataQuery.eq("priority", filters.priority);
  }
  if (filters?.category && filters.category !== "all") {
    dataQuery = dataQuery.eq("category", filters.category);
  }
  if (effectiveClientId) {
    dataQuery = dataQuery.eq("client_id", effectiveClientId);
  }

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  if (dataResult.error) {
    console.error("Error fetching tickets:", dataResult.error.message);
    return empty;
  }

  const total = countResult.count ?? 0;
  let tickets = ((dataResult.data || []) as unknown as TicketRow[]).map(transformTicketRow);

  // Client-side search filter
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    tickets = tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.client_name.toLowerCase().includes(searchLower)
    );
  }

  return {
    tickets,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getTicket(id: string): Promise<TicketWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tickets")
    .select(`
      *,
      client:clients!client_id(business_name),
      creator:profiles!created_by(full_name),
      assignee:profiles!assigned_to(full_name),
      ticket_replies(count)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching ticket:", error);
    return null;
  }

  return transformTicketRow(data as unknown as TicketRow);
}

export async function getTicketReplies(ticketId: string): Promise<TicketReplyWithUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ticket_replies")
    .select(`
      *,
      user:profiles!user_id(full_name, role, avatar_url)
    `)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching ticket replies:", error);
    return [];
  }

  type ReplyRow = {
    id: string;
    ticket_id: string;
    user_id: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    user: { full_name: string; role: string; avatar_url: string | null } | null;
  };

  return ((data || []) as ReplyRow[]).map((reply) => ({
    id: reply.id,
    ticket_id: reply.ticket_id,
    user_id: reply.user_id,
    content: reply.content,
    is_internal: reply.is_internal,
    created_at: reply.created_at,
    user_name: reply.user?.full_name || "Unknown",
    user_role: (reply.user?.role as "admin" | "client") || "client",
    user_avatar: reply.user?.avatar_url || null,
  }));
}

export async function createTicketAction(
  data: CreateTicketData
): Promise<{ success: boolean; error?: string; ticketId?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const subject = data.subject.trim();
  const description = data.description.trim();

  if (!subject) return { success: false, error: "Subject is required" };
  if (!description) return { success: false, error: "Description is required" };
  if (subject.length > 200) return { success: false, error: "Subject must be under 200 characters" };
  if (description.length > 10000) return { success: false, error: "Description must be under 10,000 characters" };

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      client_id: data.client_id,
      created_by: user.id,
      subject,
      description,
      priority: data.priority || "medium",
      category: data.category || "support",
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating ticket:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/tickets");
  return { success: true, ticketId: ticket.id };
}

export async function updateTicketStatusAction(
  id: string,
  status: TicketStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "closed") {
    updateData.closed_at = new Date().toISOString();
  } else {
    updateData.closed_at = null;
  }

  const { error } = await supabase
    .from("tickets")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error updating ticket status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  return { success: true };
}

export async function updateTicketAction(
  id: string,
  data: {
    priority?: TicketPriority;
    category?: TicketCategory;
    assigned_to?: string | null;
    due_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const adminCheck = await requireAdmin();
  if (!adminCheck.success) {
    return { success: false, error: adminCheck.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tickets")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error updating ticket:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  return { success: true };
}

export async function addTicketReplyAction(
  ticketId: string,
  content: string,
  isInternal = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Reply content is required" };
  if (trimmed.length > 10000) return { success: false, error: "Reply must be under 10,000 characters" };

  const { error } = await supabase.from("ticket_replies").insert({
    ticket_id: ticketId,
    user_id: user.id,
    content: trimmed,
    is_internal: isInternal,
  });

  if (error) {
    console.error("Error adding ticket reply:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteTicketAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const adminCheck = await requireAdmin();
  if (!adminCheck.success) {
    return { success: false, error: adminCheck.error };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("tickets").delete().eq("id", id);

  if (error) {
    console.error("Error deleting ticket:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/tickets");
  return { success: true };
}

/** Get user's clients for the ticket creation form */
export async function getClientsForTickets(): Promise<{ id: string; business_name: string }[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();

  if (profile.role === "admin") {
    const { data } = await supabase
      .from("clients")
      .select("id, business_name")
      .order("business_name");
    return (data || []) as { id: string; business_name: string }[];
  }

  // For clients, get their associated clients
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("user_id", profile.id);

  if (!clientUsers || clientUsers.length === 0) return [];

  const clientIds = clientUsers.map((cu) => cu.client_id);
  const { data } = await supabase
    .from("clients")
    .select("id, business_name")
    .in("id", clientIds)
    .order("business_name");

  return (data || []) as { id: string; business_name: string }[];
}

/** Get admin users for assignee dropdown */
export async function getAdminUsers(): Promise<{ id: string; full_name: string }[]> {
  const adminCheck = await requireAdmin();
  if (!adminCheck.success) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .order("full_name");

  return (data || []) as { id: string; full_name: string }[];
}

/** Get or create an active support chat ticket for the current user */
export async function getOrCreateChatTicket(
  clientId: string
): Promise<{ ticketId: string; isNew: boolean } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Find most recent open/in-progress ticket created by this user for this client
  const { data: existing } = await supabase
    .from("tickets")
    .select("id")
    .eq("created_by", user.id)
    .eq("client_id", clientId)
    .in("status", ["open", "in_progress"])
    .eq("category", "support")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return { ticketId: existing.id, isNew: false };
  }

  // Create a new support chat ticket
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      client_id: clientId,
      created_by: user.id,
      subject: "Live Chat",
      description: "Started via chat widget",
      status: "open",
      priority: "medium",
      category: "support",
    })
    .select("id")
    .single();

  if (error || !ticket) return null;
  return { ticketId: ticket.id, isNew: true };
}

/** Get recent chat messages (replies) for the chat widget */
export async function getChatMessages(ticketId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ticket_replies")
    .select(`
      id, ticket_id, user_id, content, is_internal, created_at,
      user:profiles!user_id(full_name, role, avatar_url)
    `)
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return [];

  type Row = {
    id: string;
    ticket_id: string;
    user_id: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    user: { full_name: string; role: string; avatar_url: string | null } | null;
  };

  return ((data || []) as Row[]).map((r) => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    user_id: r.user_id,
    user_name: r.user?.full_name || "Unknown",
    user_role: r.user?.role as "admin" | "client",
    user_avatar: r.user?.avatar_url || null,
  }));
}
