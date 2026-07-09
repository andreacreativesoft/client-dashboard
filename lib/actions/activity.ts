"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type ActivityType } from "@/lib/constants/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActivityLog, ActivityLogWithUser } from "@/types/database";

interface LogActivityParams {
    clientId?: string | null;
    actionType: ActivityType;
    /** Optional plain-text fallback; the UI renders from actionType + metadata. */
    description?: string;
    metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("activity_logs").insert({
        client_id: params.clientId || null,
        user_id: user?.id || null,
        action_type: params.actionType,
        description: params.description ?? "",
        metadata: params.metadata || {},
    });

    if (error) {
        // Don't throw - activity logging should not break main functionality
        // Table may not exist if migration 005_activity_logs.sql hasn't been run
    }
}

/** Enrich activity logs with user names/emails via batch profile lookup */
async function enrichLogsWithUsers(
    supabase: SupabaseClient,
    logs: ActivityLog[],
): Promise<ActivityLogWithUser[]> {
    const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))] as string[];

    const userMap: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);

        if (profiles) {
            for (const profile of profiles as { id: string; full_name: string; email: string }[]) {
                userMap[profile.id] = {
                    full_name: profile.full_name,
                    email: profile.email,
                };
            }
        }
    }

    return logs.map((log) => ({
        ...log,
        user_name: log.user_id ? userMap[log.user_id]?.full_name || null : null,
        user_email: log.user_id ? userMap[log.user_id]?.email || null : null,
    }));
}

export async function getClientActivity(
    clientId: string,
    limit = 50,
): Promise<ActivityLogWithUser[]> {
    // Use admin client to bypass RLS — activity_logs may not have migration run
    const adminClient = createAdminClient();

    const { data: logs, error } = await adminClient
        .from("activity_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !logs) {
        // Table may not exist if migration 005_activity_logs.sql hasn't been run
        return [];
    }

    return enrichLogsWithUsers(adminClient, logs as ActivityLog[]);
}

export interface ActivityPage {
    activities: ActivityLogWithUser[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
}

/**
 * Cross-client activity feed for admins, filterable by client and action type.
 * Enriches rows with both the actor's name and the client's business name.
 */
export async function getActivityPaginated(
    filters: { clientId?: string; actionType?: string },
    page = 1,
    perPage = 30,
): Promise<ActivityPage> {
    const adminClient = createAdminClient();
    const empty: ActivityPage = { activities: [], total: 0, page: 1, perPage, totalPages: 0 };

    const safePage = Math.max(1, page);
    const from = (safePage - 1) * perPage;
    const to = from + perPage - 1;

    let countQuery = adminClient.from("activity_logs").select("id", { count: "exact", head: true });
    let dataQuery = adminClient
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

    if (filters.clientId) {
        countQuery = countQuery.eq("client_id", filters.clientId);
        dataQuery = dataQuery.eq("client_id", filters.clientId);
    }
    if (filters.actionType) {
        countQuery = countQuery.eq("action_type", filters.actionType);
        dataQuery = dataQuery.eq("action_type", filters.actionType);
    }

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);
    if (dataResult.error || !dataResult.data) return empty;

    const logs = dataResult.data as ActivityLog[];
    const withUsers = await enrichLogsWithUsers(adminClient, logs);

    // Resolve client names in one batch for the cross-client view.
    const clientIds = [...new Set(logs.map((l) => l.client_id).filter(Boolean))] as string[];
    const clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
        const { data: clients } = await adminClient
            .from("clients")
            .select("id, business_name")
            .in("id", clientIds);
        for (const c of (clients || []) as { id: string; business_name: string }[]) {
            clientMap[c.id] = c.business_name;
        }
    }

    const activities = withUsers.map((a) => ({
        ...a,
        client_name: a.client_id ? (clientMap[a.client_id] ?? null) : null,
    }));

    const total = countResult.count ?? 0;
    return {
        activities,
        total,
        page: safePage,
        perPage,
        totalPages: Math.ceil(total / perPage),
    };
}

export async function getRecentActivity(limit = 20): Promise<ActivityLogWithUser[]> {
    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    const { data: logs, error } = await adminClient
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !logs) {
        // Table may not exist if migration 005_activity_logs.sql hasn't been run
        return [];
    }

    return enrichLogsWithUsers(adminClient, logs as ActivityLog[]);
}
