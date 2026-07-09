"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { getProfile } from "@/lib/actions/profile";
import { ActivityTypes } from "@/lib/constants/activity";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/view-context";
import type { Submission, SubmissionStatus } from "@/types/database";

export type SubmissionWithDetails = Submission & {
    connector_label: string | null;
    connector_kind: string | null;
    website_name: string | null;
    website_url: string | null;
    client_name: string;
};

export type SubmissionFilters = {
    status?: SubmissionStatus | "all";
    websiteId?: string;
    clientId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
};

export type PaginatedSubmissions = {
    submissions: SubmissionWithDetails[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
};

// Submission + relations jointes. Le site se dérive via le connecteur d'origine
// (null pour une saisie manuelle).
type SubmissionWithRelations = Submission & {
    connector: {
        id: string;
        label: string;
        kind: string;
        website: { id: string; name: string; url: string } | null;
    } | null;
    client: { id: string; business_name: string } | null;
};

/**
 * Échappe un terme de recherche pour un filtre PostgREST `.or()` ilike :
 * retire les caractères porteurs de sens (virgule, parenthèses, wildcards, backslash).
 */
function sanitizeSearch(term: string): string {
    return term.replace(/[,()%*\\_]/g, " ").trim();
}

/** Résout les connecteurs d'un site (pour filtrer les submissions par site). */
async function connectorIdsForWebsite(
    supabase: SupabaseClient,
    websiteId: string,
): Promise<string[]> {
    const { data } = await supabase.from("connectors").select("id").eq("website_id", websiteId);
    return ((data as { id: string }[] | null) ?? []).map((c) => c.id);
}

function applySubmissionQueryFilters<
    T extends {
        eq: (col: string, val: string) => T;
        in: (col: string, vals: string[]) => T;
        gte: (col: string, val: string) => T;
        lte: (col: string, val: string) => T;
        or: (filter: string) => T;
    },
>(
    query: T,
    filters: SubmissionFilters | undefined,
    clientId: string | null,
    connectorIds: string[] | null,
): T {
    if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
    }
    if (connectorIds) {
        // Filtre par site : restreint aux connecteurs de ce site (aucun → ensemble vide).
        query = query.in("connector_id", connectorIds.length > 0 ? connectorIds : ["__none__"]);
    }
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
    if (filters?.search) {
        const safe = sanitizeSearch(filters.search);
        if (safe) {
            query = query.or(
                `name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,message.ilike.%${safe}%`,
            );
        }
    }
    return query;
}

function transformRows(
    data: SubmissionWithRelations[],
    opts: {
        isAdmin: boolean;
        userClientIds: string[];
        impersonatedClientId: string | null;
    },
): SubmissionWithDetails[] {
    const rows: SubmissionWithDetails[] = [];

    for (const item of data) {
        const { connector, client } = item;
        if (!client) continue;

        if (opts.impersonatedClientId && item.client_id !== opts.impersonatedClientId) continue;
        if (!opts.isAdmin && !opts.userClientIds.includes(item.client_id)) continue;

        rows.push({
            ...item,
            connector_label: connector?.label ?? null,
            connector_kind: connector?.kind ?? null,
            website_name: connector?.website?.name ?? null,
            website_url: connector?.website?.url ?? null,
            client_name: client.business_name,
        });
    }

    return rows;
}

const SELECT = `
    *,
    connector:connectors!connector_id(id, label, kind, website:websites!website_id(id, name, url)),
    client:clients!client_id(id, business_name)
`;

// ─── Stats (agrégées en base — jamais en chargeant toutes les lignes) ────────

export type SubmissionStats = {
    total: number;
    last7: number;
    last30: number;
    new30: number;
    contacted30: number;
    done30: number;
    new7: number;
};

const ISO = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Client effectif : impersonation (admin) ou client unique de l'utilisateur. */
async function effectiveScope() {
    const profile = await getProfile();
    if (!profile) return null;
    const supabase = await createClient();
    const clientId = await getActiveClientId();
    return { supabase, clientId };
}

/** Compteurs de submissions via `count: exact, head` (aucune ligne chargée). */
export async function getSubmissionStats(): Promise<SubmissionStats> {
    const empty: SubmissionStats = {
        total: 0,
        last7: 0,
        last30: 0,
        new30: 0,
        contacted30: 0,
        done30: 0,
        new7: 0,
    };
    const scope = await effectiveScope();
    if (!scope) return empty;
    const { supabase, clientId } = scope;
    const d7 = ISO(7);
    const d30 = ISO(30);

    const base = () => {
        const q = supabase.from("submissions").select("id", { count: "exact", head: true });
        return clientId ? q.eq("client_id", clientId) : q;
    };

    const [total, last7, last30, new30, contacted30, done30, new7] = await Promise.all([
        base(),
        base().gte("created_at", d7),
        base().gte("created_at", d30),
        base().gte("created_at", d30).eq("status", "new"),
        base().gte("created_at", d30).eq("status", "contacted"),
        base().gte("created_at", d30).eq("status", "done"),
        base().gte("created_at", d7).eq("status", "new"),
    ]);

    return {
        total: total.count ?? 0,
        last7: last7.count ?? 0,
        last30: last30.count ?? 0,
        new30: new30.count ?? 0,
        contacted30: contacted30.count ?? 0,
        done30: done30.count ?? 0,
        new7: new7.count ?? 0,
    };
}

/** Comptes journaliers (sparse) sur N jours — agrégés en base (RPC). */
export async function getSubmissionDailyCounts(
    days = 30,
): Promise<{ date: string; count: number }[]> {
    const scope = await effectiveScope();
    if (!scope) return [];
    const { data, error } = await scope.supabase.rpc("submission_daily_counts", {
        p_client_id: scope.clientId,
        p_days: days,
    });
    if (error) {
        console.error("Error fetching daily counts:", error.message);
        return [];
    }
    return (data ?? []).map((r) => ({ date: r.day, count: Number(r.count) }));
}

/** Top sources (par site/connecteur d'origine) sur N jours — agrégé en base (RPC). */
export async function getSubmissionTopSources(
    days = 30,
    limit = 5,
): Promise<{ source: string; count: number }[]> {
    const scope = await effectiveScope();
    if (!scope) return [];
    const { data, error } = await scope.supabase.rpc("submission_top_sources", {
        p_client_id: scope.clientId,
        p_days: days,
        p_limit: limit,
    });
    if (error) {
        console.error("Error fetching top sources:", error.message);
        return [];
    }
    return (data ?? []).map((r) => ({ source: r.source, count: Number(r.count) }));
}

export async function getSubmissionsPaginated(
    filters?: SubmissionFilters,
    page = 1,
    perPage = 10,
): Promise<PaginatedSubmissions> {
    const empty: PaginatedSubmissions = { submissions: [], total: 0, page, perPage, totalPages: 0 };

    const profile = await getProfile();
    if (!profile) return empty;

    const supabase = await createClient();
    const isAdmin = profile.role === "admin";
    const activeClientId = await getActiveClientId();

    // One account = one business: a client is always scoped to their own client;
    // an admin is scoped to the client they impersonate, or may filter explicitly
    // in agency mode.
    let effectiveClientId: string | null = activeClientId;
    if (!effectiveClientId && isAdmin && filters?.clientId) {
        effectiveClientId = filters.clientId;
    }

    const connectorIds = filters?.websiteId
        ? await connectorIdsForWebsite(supabase, filters.websiteId)
        : null;

    let countQuery = supabase.from("submissions").select("id", { count: "exact", head: true });
    countQuery = applySubmissionQueryFilters(countQuery, filters, effectiveClientId, connectorIds);

    const offset = (page - 1) * perPage;
    let dataQuery = supabase
        .from("submissions")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .range(offset, offset + perPage - 1);
    dataQuery = applySubmissionQueryFilters(dataQuery, filters, effectiveClientId, connectorIds);

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (dataResult.error) {
        console.error("Error fetching paginated submissions:", dataResult.error.message);
        return empty;
    }

    const total = countResult.count ?? 0;
    const submissions = transformRows(
        (dataResult.data || []) as unknown as SubmissionWithRelations[],
        {
            isAdmin,
            userClientIds: activeClientId ? [activeClientId] : [],
            impersonatedClientId: isAdmin ? activeClientId : null,
        },
    );

    return { submissions, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

export async function getSubmission(id: string): Promise<SubmissionWithDetails | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.from("submissions").select(SELECT).eq("id", id).single();
    if (error || !data) {
        console.error("Error fetching submission:", error);
        return null;
    }

    const typed = data as unknown as SubmissionWithRelations;
    if (!typed.client) return null;

    return {
        ...typed,
        connector_label: typed.connector?.label ?? null,
        connector_kind: typed.connector?.kind ?? null,
        website_name: typed.connector?.website?.name ?? null,
        website_url: typed.connector?.website?.url ?? null,
        client_name: typed.client.business_name,
    };
}

export async function updateSubmissionStatusAction(
    id: string,
    status: SubmissionStatus,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("submissions")
        .update({ status })
        .eq("id", id)
        .select("client_id, name")
        .single();

    if (error) {
        console.error("Error updating submission status:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: data?.client_id ?? null,
        actionType: ActivityTypes.SUBMISSION_STATUS_CHANGED,
        metadata: {
            submissionId: id,
            clientId: data?.client_id ?? null,
            submissionName: data?.name ?? "",
            status,
        },
    });

    revalidatePath("/submissions");
    revalidatePath(`/submissions/${id}`);
    return { success: true };
}

export async function deleteSubmissionAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
        console.error("Error deleting submission:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/submissions");
    return { success: true };
}

export type SubmissionNoteWithUser = {
    id: string;
    submission_id: string;
    user_id: string;
    content: string;
    created_at: string;
    user_name: string;
};

export async function getSubmissionNotes(submissionId: string): Promise<SubmissionNoteWithUser[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("submission_notes")
        .select(`*, profile:profiles(full_name)`)
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching submission notes:", error);
        return [];
    }

    type NoteWithProfile = {
        id: string;
        submission_id: string;
        user_id: string;
        content: string;
        created_at: string;
        profile: { full_name: string } | null;
    };

    return ((data || []) as unknown as NoteWithProfile[]).map((note) => ({
        id: note.id,
        submission_id: note.submission_id,
        user_id: note.user_id,
        content: note.content,
        created_at: note.created_at,
        user_name: note.profile?.full_name || "Unknown",
    }));
}

export async function addSubmissionNoteAction(
    submissionId: string,
    content: string,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const trimmed = content.trim();
    if (!trimmed) return { success: false, error: "Note content is required" };
    if (trimmed.length > 5000) {
        return { success: false, error: "Note content must be under 5,000 characters" };
    }

    const { error } = await supabase.from("submission_notes").insert({
        submission_id: submissionId,
        user_id: user.id,
        content: trimmed,
    });

    if (error) {
        console.error("Error adding submission note:", error);
        return { success: false, error: error.message };
    }

    const { data: submission } = await supabase
        .from("submissions")
        .select("client_id, name")
        .eq("id", submissionId)
        .single();
    await logActivity({
        clientId: submission?.client_id ?? null,
        actionType: ActivityTypes.SUBMISSION_NOTE_ADDED,
        metadata: {
            submissionId,
            clientId: submission?.client_id ?? null,
            submissionName: submission?.name ?? "",
            authorId: user.id,
        },
    });

    revalidatePath(`/submissions/${submissionId}`);
    return { success: true };
}

export async function getSubmissionCountForClient(clientId: string): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);

    if (error) {
        console.error("Error fetching submission count:", error);
        return 0;
    }

    return count || 0;
}
