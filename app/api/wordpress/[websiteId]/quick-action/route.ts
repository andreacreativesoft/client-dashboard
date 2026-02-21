import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { websiteId } = await params;
  const { action, payload } = await request.json();

  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const integrationId = client.integrationIdValue;
    const supabase = await createClient();

    // Queue the action
    const { data: queueEntry } = await supabase
      .from("wp_action_queue")
      .insert({
        website_id: websiteId,
        integration_id: integrationId,
        initiated_by: auth.userId,
        action_type: `quick_${action}`,
        action_payload: payload || {},
        status: "processing" as const,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const actionId = (queueEntry as { id: string } | null)?.id;

    try {
      let result: unknown;

      switch (action) {
        case "clear_cache":
          result = await client.clearCache();
          break;
        case "toggle_maintenance":
          result = await client.toggleMaintenance(!!payload?.enable);
          break;
        case "toggle_debug":
          result = await client.toggleDebugMode(!!payload?.enable);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Mark completed
      if (actionId) {
        await supabase
          .from("wp_action_queue")
          .update({
            status: "completed" as const,
            after_state: result as Record<string, unknown>,
            completed_at: new Date().toISOString(),
          })
          .eq("id", actionId);
      }

      return NextResponse.json({ success: true, result });
    } catch (error) {
      // Mark failed
      if (actionId) {
        await supabase
          .from("wp_action_queue")
          .update({
            status: "failed" as const,
            error_message: (error as Error).message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", actionId);
      }

      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
