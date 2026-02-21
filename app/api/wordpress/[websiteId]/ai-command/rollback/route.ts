import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { createClient } from "@/lib/supabase/server";
import type { WPActionQueueRow } from "@/types/database";

interface BeforeState {
  resource_type: string;
  resource_id: string;
  field: string;
  value: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { websiteId } = await params;
  const { action_ids }: { action_ids: string[] } = await request.json();

  if (!action_ids || !Array.isArray(action_ids) || action_ids.length === 0) {
    return NextResponse.json({ error: "action_ids array required" }, { status: 400 });
  }

  const client = await WPClient.fromWebsiteId(websiteId);
  const supabase = await createClient();

  const results: { action_id: string; success: boolean; error?: string }[] = [];

  // Rollback in reverse order
  for (const actionId of [...action_ids].reverse()) {
    const { data: action } = await supabase
      .from("wp_action_queue")
      .select("*")
      .eq("id", actionId)
      .eq("website_id", websiteId)
      .single();

    const typedAction = action as WPActionQueueRow | null;
    if (!typedAction || typedAction.status !== "completed" || !typedAction.before_state) {
      results.push({
        action_id: actionId,
        success: false,
        error: "Action not rollbackable",
      });
      continue;
    }

    const beforeState = typedAction.before_state as unknown as BeforeState;

    try {
      const resourceId = parseInt(beforeState.resource_id, 10);

      switch (beforeState.resource_type) {
        case "media":
          await client.updateMediaItem(resourceId, {
            [beforeState.field]: beforeState.value,
          });
          break;

        case "page":
          if (beforeState.field === "meta_description") {
            await client.updatePage(resourceId, {
              meta: { _yoast_wpseo_metadesc: beforeState.value },
            } as Record<string, unknown>);
          } else {
            await client.updatePage(resourceId, {
              [beforeState.field]: beforeState.value,
            } as Record<string, unknown>);
          }
          break;

        case "post":
          if (beforeState.field === "meta_description") {
            await client.updatePost(resourceId, {
              meta: { _yoast_wpseo_metadesc: beforeState.value },
            } as Record<string, unknown>);
          } else {
            await client.updatePost(resourceId, {
              [beforeState.field]: beforeState.value,
            } as Record<string, unknown>);
          }
          break;

        default:
          throw new Error(`Unsupported rollback for: ${beforeState.resource_type}`);
      }

      await supabase
        .from("wp_action_queue")
        .update({ status: "rolled_back" as const })
        .eq("id", actionId);

      results.push({ action_id: actionId, success: true });
    } catch (error) {
      results.push({
        action_id: actionId,
        success: false,
        error: (error as Error).message,
      });
    }
  }

  return NextResponse.json({ results });
}
