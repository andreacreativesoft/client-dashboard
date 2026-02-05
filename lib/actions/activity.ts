"use server";

import { createClient } from "@/lib/supabase/server";
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
    console.error("Error logging activity:", error);
    // Don't throw - activity logging should not break main functionality
  }
}

export async function getClientActivity(
  clientId: string,
  limit = 50
): Promise<ActivityLogWithUser[]> {
  const supabase = await createClient();

  // Fetch activity logs
  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ActivityLog[]>();

  if (error || !logs) {
    console.error("Error fetching activity:", error);
    return [];
  }

  // Get unique user IDs
  const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))] as string[];

  // Fetch user details
  const userMap: Record<string, { full_name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profiles) {
      for (const profile of profiles) {
        userMap[profile.id] = {
          full_name: profile.full_name,
          email: profile.email,
        };
      }
    }
  }

  // Combine logs with user info
  return logs.map((log) => ({
    ...log,
    user_name: log.user_id ? userMap[log.user_id]?.full_name || null : null,
    user_email: log.user_id ? userMap[log.user_id]?.email || null : null,
  }));
}

export async function getRecentActivity(limit = 20): Promise<ActivityLogWithUser[]> {
  const supabase = await createClient();

  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ActivityLog[]>();

  if (error || !logs) {
    console.error("Error fetching recent activity:", error);
    return [];
  }

  // Get unique user IDs
  const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))] as string[];

  // Fetch user details
  const userMap: Record<string, { full_name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profiles) {
      for (const profile of profiles) {
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
