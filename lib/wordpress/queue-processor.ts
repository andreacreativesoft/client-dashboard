/**
 * Queue processor utility for WordPress action queue.
 * Handles sequential action processing per website, with status tracking
 * and conflict detection for concurrent edits to the same resource.
 */

import { createClient } from "@/lib/supabase/server";
import type { WPActionQueueRow } from "@/types/database";

// ─── Types ──────────────────────────────────────────────────────────────

export interface QueueEntry {
  website_id: string;
  integration_id: string;
  initiated_by: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  before_state?: Record<string, unknown>;
  resource_type?: string;
  resource_id?: string;
  priority?: number;
  status?: "pending" | "processing";
}

export interface QueueResult {
  action_id: string | null;
  success: boolean;
  error?: string;
}

// ─── Enqueue ────────────────────────────────────────────────────────────

/**
 * Insert a new action into the queue. Returns the queue entry ID.
 */
export async function enqueueAction(entry: QueueEntry): Promise<QueueResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wp_action_queue")
    .insert({
      website_id: entry.website_id,
      integration_id: entry.integration_id,
      initiated_by: entry.initiated_by,
      action_type: entry.action_type,
      action_payload: entry.action_payload,
      before_state: entry.before_state ?? null,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      priority: entry.priority ?? 5,
      status: entry.status ?? "pending",
      started_at: entry.status === "processing" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { action_id: null, success: false, error: error?.message ?? "Failed to enqueue" };
  }

  return { action_id: (data as { id: string }).id, success: true };
}

// ─── Complete / Fail ────────────────────────────────────────────────────

/**
 * Mark an action as completed with optional after_state.
 */
export async function completeAction(
  actionId: string,
  afterState?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("wp_action_queue")
    .update({
      status: "completed" as const,
      after_state: afterState ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", actionId);
}

/**
 * Mark an action as failed with an error message.
 */
export async function failAction(
  actionId: string,
  errorMessage: string
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("wp_action_queue")
    .update({
      status: "failed" as const,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", actionId);
}

// ─── Conflict Detection ─────────────────────────────────────────────────

/**
 * Check if a resource is currently being modified by another action.
 * Returns the conflicting action if one exists, or null if safe to proceed.
 */
export async function checkResourceConflict(
  websiteId: string,
  resourceType: string,
  resourceId: string
): Promise<WPActionQueueRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("wp_action_queue")
    .select("*")
    .eq("website_id", websiteId)
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;

  return data[0] as WPActionQueueRow;
}

/**
 * Check if any resources in a batch are currently being modified.
 * Returns a map of resource keys to conflicting actions.
 */
export async function checkBatchConflicts(
  websiteId: string,
  resources: { resource_type: string; resource_id: string }[]
): Promise<Map<string, WPActionQueueRow>> {
  const conflicts = new Map<string, WPActionQueueRow>();

  if (resources.length === 0) return conflicts;

  const supabase = await createClient();

  // Get all pending/processing actions for this website
  const { data } = await supabase
    .from("wp_action_queue")
    .select("*")
    .eq("website_id", websiteId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return conflicts;

  const typedActions = data as WPActionQueueRow[];

  for (const resource of resources) {
    const conflict = typedActions.find(
      (a) =>
        a.resource_type === resource.resource_type &&
        a.resource_id === resource.resource_id
    );
    if (conflict) {
      conflicts.set(`${resource.resource_type}:${resource.resource_id}`, conflict);
    }
  }

  return conflicts;
}

// ─── Pending Actions ────────────────────────────────────────────────────

/**
 * Get the count of pending/processing actions for a website.
 */
export async function getPendingActionCount(websiteId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("wp_action_queue")
    .select("*", { count: "exact", head: true })
    .eq("website_id", websiteId)
    .in("status", ["pending", "processing"]);

  return count ?? 0;
}
