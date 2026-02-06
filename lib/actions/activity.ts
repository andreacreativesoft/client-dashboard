"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActivityLog, ActivityLogWithUser } from "@/types/database";
import { type ActivityType } from "@/lib/constants/activity";

interface LogActivityParams {
  clientId?: string | null;
  actionType: ActivityType;
  description: string;
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
    description: params.description,
    metadata: params.metadata || {},
  });

  if (error) {
    // Don't throw - activity logging should not break main functionality
    // Table may not exist if migration 005_activity_logs.sql hasn't been run
  }
}

/** Enrich activity logs with user names/emails via batch profile lookup */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichLogsWithUsers(supabase: any, logs: ActivityLog[]): Promise<ActivityLogWithUser[]> {
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
  limit = 50
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
