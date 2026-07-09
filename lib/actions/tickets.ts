"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { getProfile } from "@/lib/actions/profile";
import { requireAdmin } from "@/lib/auth";
import { ActivityTypes } from "@/lib/constants/activity";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { sendTicketReplyNotification } from "@/lib/notifications/ticket-notifications";
import { createClient } from "@/lib/supabase/server";
import {
    composeDescription,
    composeSubject,
    DEFAULT_TICKET_TYPE,
    getTicketType,
} from "@/lib/tickets/ticket-types";
import type {
    Ticket,
    TicketStatus,
    TicketPriority,
    TicketWithDetails,
    TicketReplyWithUser,
    TicketReplyKind,
    TicketReplySystemMetadata,
} from "@/types/database";

/**
 * Insère un reply « système » dans le fil d'un ticket (trace technique).
 * Best-effort : un échec ne doit pas annuler le changement métier déjà persisté.
 */
async function insertSystemReply(
    supabase: Awaited<ReturnType<typeof createClient>>,
    ticketId: string,
    userId: string,
    metadata: TicketReplySystemMetadata,
): Promise<void> {
    const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: ticketId,
        user_id: userId,
        content: "",
        is_internal: false,
        kind: "system",
        metadata,
    });
    if (error) console.error("Error inserting system reply:", error.message);
}

export type TicketSort = "recent" | "updated" | "waiting_longest";

export type TicketFilters = {
    status?: TicketStatus | TicketStatus[] | "all";
    priority?: TicketPriority | "all";
    type?: string | "all";
    /** uuid d'un admin · "unassigned" · "all"/undefined. */
    assignee?: string | "all" | "unassigned";
    clientId?: string;
    search?: string;
    sort?: TicketSort;
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
    type: string;
    details: Record<string, string>;
    priority?: TicketPriority;
    assigned_to?: string | null;
    due_date?: string | null;
};

// Raw row shape from Supabase join query
type TicketRow = Ticket & {
    client: { business_name: string } | null;
    creator: { full_name: string } | null;
    assignee: { full_name: string; avatar_url: string | null } | null;
    ticket_replies: { count: number }[];
};

function transformTicketRow(row: TicketRow): TicketWithDetails {
    return {
        ...row,
        client_name: row.client?.business_name ?? "Unknown",
        created_by_name: row.creator?.full_name ?? "Unknown",
        assigned_to_name: row.assignee?.full_name ?? null,
        assigned_to_avatar: row.assignee?.avatar_url ?? null,
        reply_count: row.ticket_replies?.[0]?.count ?? 0,
    };
}

/**
 * Escape a user search term for safe use inside a PostgREST `.or()` ilike
 * filter: comma and parens (delimiters), percent/star/underscore (wildcards),
 * and backslash (escape).
 */
function sanitizeSearch(term: string): string {
    return term.replace(/[,()%*\\_]/g, " ").trim();
}

export async function getTicketsPaginated(
    filters?: TicketFilters,
    page = 1,
    perPage = 10,
): Promise<PaginatedTickets> {
    const empty: PaginatedTickets = { tickets: [], total: 0, page, perPage, totalPages: 0 };

    const profile = await getProfile();
    if (!profile) return empty;

    const supabase = await createClient();
    const isAdmin = profile.role === "admin";
    const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

    // Build base filter params
    const effectiveClientId = impersonatedClientId || filters?.clientId || null;

    // Normalize the status filter to a list (supports single value, array, or "all")
    const statusFilter = filters?.status;
    const statuses: TicketStatus[] | null = Array.isArray(statusFilter)
        ? statusFilter
        : statusFilter && statusFilter !== "all"
          ? [statusFilter]
          : null;

    // Sort options: recent (default), last updated, longest waiting (oldest first)
    const sort = filters?.sort ?? "recent";
    const orderColumn = sort === "updated" ? "updated_at" : "created_at";
    const orderAscending = sort === "waiting_longest";

    // Resolve the search filter at the DB level so it spans the whole dataset
    // (not just the current page) and keeps the paginated count accurate. We
    // search subject/description, the ticket number (#N), and any client whose
    // name matches (resolved to ids, since clients is a joined table).
    let searchOr: string | null = null;
    if (filters?.search) {
        const safe = sanitizeSearch(filters.search);
        if (safe) {
            const parts = [`subject.ilike.%${safe}%`, `description.ilike.%${safe}%`];
            const asNumber = safe.replace(/^#/, "");
            if (/^\d+$/.test(asNumber)) parts.push(`number.eq.${asNumber}`);
            const { data: matchedClients } = await supabase
                .from("clients")
                .select("id")
                .ilike("business_name", `%${safe}%`);
            const ids = (matchedClients as { id: string }[] | null)?.map((c) => c.id) ?? [];
            if (ids.length > 0) parts.push(`client_id.in.(${ids.join(",")})`);
            searchOr = parts.join(",");
        }
    }

    // Count query
    let countQuery = supabase.from("tickets").select("id", { count: "exact", head: true });

    if (statuses && statuses.length > 0) {
        countQuery = countQuery.in("status", statuses);
    }
    if (filters?.priority && filters.priority !== "all") {
        countQuery = countQuery.eq("priority", filters.priority);
    }
    if (filters?.type && filters.type !== "all") {
        countQuery = countQuery.eq("type", filters.type);
    }
    if (filters?.assignee === "unassigned") {
        countQuery = countQuery.is("assigned_to", null);
    } else if (filters?.assignee && filters.assignee !== "all") {
        countQuery = countQuery.eq("assigned_to", filters.assignee);
    }
    if (effectiveClientId) {
        countQuery = countQuery.eq("client_id", effectiveClientId);
    }
    if (searchOr) {
        countQuery = countQuery.or(searchOr);
    }

    // Data query
    const offset = (page - 1) * perPage;
    let dataQuery = supabase
        .from("tickets")
        .select(`
      *,
      client:clients!client_id(business_name),
      creator:profiles!created_by(full_name),
      assignee:profiles!assigned_to(full_name, avatar_url),
      ticket_replies(count)
    `)
        .order(orderColumn, { ascending: orderAscending })
        .range(offset, offset + perPage - 1);

    if (statuses && statuses.length > 0) {
        dataQuery = dataQuery.in("status", statuses);
    }
    if (filters?.priority && filters.priority !== "all") {
        dataQuery = dataQuery.eq("priority", filters.priority);
    }
    if (filters?.type && filters.type !== "all") {
        dataQuery = dataQuery.eq("type", filters.type);
    }
    if (filters?.assignee === "unassigned") {
        dataQuery = dataQuery.is("assigned_to", null);
    } else if (filters?.assignee && filters.assignee !== "all") {
        dataQuery = dataQuery.eq("assigned_to", filters.assignee);
    }
    if (effectiveClientId) {
        dataQuery = dataQuery.eq("client_id", effectiveClientId);
    }
    if (searchOr) {
        dataQuery = dataQuery.or(searchOr);
    }

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (dataResult.error) {
        console.error("Error fetching tickets:", dataResult.error.message);
        return empty;
    }

    const total = countResult.count ?? 0;
    const tickets = ((dataResult.data || []) as unknown as TicketRow[]).map(transformTicketRow);

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
      assignee:profiles!assigned_to(full_name, avatar_url),
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

/**
 * Most recently active (non-closed) ticket for a client — powers the client
 * page's "latest open request" snapshot. Null when the client has no open ticket.
 */
export async function getLatestOpenTicketForClient(
    clientId: string,
): Promise<TicketWithDetails | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("tickets")
        .select(`
      *,
      client:clients!client_id(business_name),
      creator:profiles!created_by(full_name),
      assignee:profiles!assigned_to(full_name, avatar_url),
      ticket_replies(count)
    `)
        .eq("client_id", clientId)
        .in("status", ["open", "in_progress", "waiting_on_client"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    return transformTicketRow(data as unknown as TicketRow);
}

export type ChatTicketSummary = {
    id: string;
    number: number;
    subject: string;
    status: TicketStatus;
    created_at: string;
};

/** Demandes récentes d'un client (raccourci de suivi dans la pop-up support). */
export async function getRecentTicketsForClient(
    clientId: string,
    limit = 4,
): Promise<ChatTicketSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("tickets")
        .select("id, number, subject, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data as ChatTicketSummary[];
}

/** Nombre total de demandes d'un client (tous statuts) — carte Statistiques. */
export async function getTicketCountForClient(clientId: string): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
    return count ?? 0;
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
        kind: TicketReplyKind;
        metadata: TicketReplySystemMetadata | null;
        created_at: string;
        user: { full_name: string; role: string; avatar_url: string | null } | null;
    };

    return ((data || []) as unknown as ReplyRow[]).map((reply) => ({
        id: reply.id,
        ticket_id: reply.ticket_id,
        user_id: reply.user_id,
        content: reply.content,
        is_internal: reply.is_internal,
        kind: reply.kind ?? "reply",
        metadata: reply.metadata ?? {},
        created_at: reply.created_at,
        user_name: reply.user?.full_name || "Unknown",
        user_role: (reply.user?.role as "admin" | "client") || "client",
        user_avatar: reply.user?.avatar_url || null,
    }));
}

export async function createTicketAction(
    data: CreateTicketData,
): Promise<{ success: boolean; error?: string; ticketId?: string }> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Type de demande (registry) → sujet + description composés ; details bornés.
    const type = getTicketType(data.type) ?? getTicketType(DEFAULT_TICKET_TYPE)!;
    const details: Record<string, string> = {};
    for (const field of type.fields) {
        const value = (data.details?.[field.key] ?? "").trim().slice(0, 10000);
        if (field.required && !value) {
            return { success: false, error: `Champ requis manquant : ${field.key}` };
        }
        if (value) details[field.key] = value;
    }

    const subject = composeSubject(type, details);
    const description = composeDescription(type, details, "fr-BE");
    if (!subject) return { success: false, error: "Subject is required" };

    const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
            client_id: data.client_id,
            created_by: user.id,
            subject,
            description,
            type: type.id,
            details,
            priority: data.priority || type.defaultPriority,
            assigned_to: data.assigned_to || null,
            due_date: data.due_date || null,
            status: "open",
        })
        .select("id, number, client_id")
        .single();

    if (error) {
        console.error("Error creating ticket:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: ticket.client_id,
        actionType: ActivityTypes.TICKET_CREATED,
        metadata: {
            ticketId: ticket.id,
            clientId: ticket.client_id,
            number: ticket.number,
            subject,
            createdBy: user.id,
        },
    });

    revalidatePath("/tickets");
    return { success: true, ticketId: ticket.id };
}

export async function updateTicketStatusAction(
    id: string,
    status: TicketStatus,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Snapshot the previous status to record the from→to transition in the thread.
    const { data: before } = await supabase.from("tickets").select("status").eq("id", id).single();

    const updateData: Record<string, unknown> = { status };
    if (status === "closed") {
        updateData.closed_at = new Date().toISOString();
    } else {
        updateData.closed_at = null;
    }

    const { data: ticket, error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", id)
        .select("number, client_id")
        .single();

    if (error) {
        console.error("Error updating ticket status:", error);
        return { success: false, error: error.message };
    }

    // System reply: trace the status change in the discussion thread.
    if (user && before && before.status !== status) {
        await insertSystemReply(supabase, id, user.id, {
            event: "status_changed",
            from: before.status,
            to: status,
        });
    }

    await logActivity({
        clientId: ticket?.client_id ?? null,
        actionType: ActivityTypes.TICKET_STATUS_CHANGED,
        metadata: {
            ticketId: id,
            clientId: ticket?.client_id ?? null,
            number: ticket?.number ?? "",
            status,
        },
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${id}`);
    revalidatePath(`/admin/tickets/${id}`);
    return { success: true };
}

export async function updateTicketAction(
    id: string,
    data: {
        priority?: TicketPriority;
        assigned_to?: string | null;
        due_date?: string | null;
    },
): Promise<{ success: boolean; error?: string }> {
    const adminCheck = await requireAdmin();
    if (!adminCheck.success) {
        return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();

    // Snapshot the previous priority/assignee to trace changes in the thread.
    const { data: before } = await supabase
        .from("tickets")
        .select("priority, assigned_to")
        .eq("id", id)
        .single();

    const { error } = await supabase.from("tickets").update(data).eq("id", id);

    if (error) {
        console.error("Error updating ticket:", error);
        return { success: false, error: error.message };
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user && data.priority && before && before.priority !== data.priority) {
        await insertSystemReply(supabase, id, user.id, {
            event: "priority_changed",
            from: before.priority,
            to: data.priority,
        });
    }

    // Journalise l'(dé)assignation avec le nom du nouvel assigné.
    if (
        user &&
        before &&
        data.assigned_to !== undefined &&
        before.assigned_to !== data.assigned_to
    ) {
        let assigneeName: string | null = null;
        if (data.assigned_to) {
            const { data: who } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", data.assigned_to)
                .single();
            assigneeName = who?.full_name ?? null;
        }
        await insertSystemReply(supabase, id, user.id, { event: "assigned", to: assigneeName });
    }

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${id}`);
    revalidatePath(`/admin/tickets/${id}`);
    return { success: true };
}

export async function addTicketReplyAction(
    ticketId: string,
    content: string,
    isInternal = false,
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
    if (trimmed.length > 10000)
        return { success: false, error: "Reply must be under 10,000 characters" };

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

    const { data: ticket } = await supabase
        .from("tickets")
        .select("number, client_id, subject")
        .eq("id", ticketId)
        .single();

    const { data: author } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    await logActivity({
        clientId: ticket?.client_id ?? null,
        actionType: ActivityTypes.TICKET_REPLIED,
        metadata: {
            ticketId,
            clientId: ticket?.client_id ?? null,
            number: ticket?.number ?? "",
            authorId: user.id,
            isInternal,
        },
    });

    // Email the client's users when the agency posts a client-facing reply.
    if (!isInternal && author?.role === "admin" && ticket?.client_id) {
        await sendTicketReplyNotification({
            ticketId,
            clientId: ticket.client_id,
            ticketNumber: ticket.number ?? "",
            subject: ticket.subject ?? "",
            content: trimmed,
            authorName: author.full_name || "Votre Site Pro",
            authorId: user.id,
        });
    }

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets/${ticketId}`);
    return { success: true };
}

/**
 * Delete a ticket reply. Admin-only, and restricted to internal notes:
 * client-facing replies are part of the conversation record and stay immutable.
 */
export async function deleteTicketReplyAction(
    replyId: string,
): Promise<{ success: boolean; error?: string }> {
    const adminCheck = await requireAdmin();
    if (!adminCheck.success) {
        return { success: false, error: adminCheck.error };
    }

    const supabase = await createClient();

    const { data: reply, error: fetchError } = await supabase
        .from("ticket_replies")
        .select("ticket_id, is_internal")
        .eq("id", replyId)
        .single();

    if (fetchError || !reply) {
        return { success: false, error: fetchError?.message || "Reply not found" };
    }
    if (!reply.is_internal) {
        return { success: false, error: "Only internal notes can be deleted" };
    }

    const { error } = await supabase.from("ticket_replies").delete().eq("id", replyId);

    if (error) {
        console.error("Error deleting ticket reply:", error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/tickets/${reply.ticket_id}`);
    revalidatePath(`/admin/tickets/${reply.ticket_id}`);
    return { success: true };
}

export async function deleteTicketAction(
    id: string,
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
