import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { createClient } from "@/lib/supabase/server";

interface ChangeToApply {
  id: string;
  resource_type: string;
  resource_id: string;
  resource_title: string;
  field: string;
  current_value: string;
  proposed_value: string;
  selected: boolean;
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
  const { changes }: { changes: ChangeToApply[] } = await request.json();

  if (!changes || !Array.isArray(changes)) {
    return NextResponse.json({ error: "Changes array required" }, { status: 400 });
  }

  const client = await WPClient.fromWebsiteId(websiteId);
  const integrationId = client.integrationIdValue;
  const supabase = await createClient();

  const results: { change_id: string; success: boolean; error?: string; action_id?: string }[] = [];

  for (const change of changes) {
    if (!change.selected) continue;

    // Queue with before_state for rollback
    const { data: queueEntry } = await supabase
      .from("wp_action_queue")
      .insert({
        website_id: websiteId,
        integration_id: integrationId,
        initiated_by: auth.userId,
        action_type: `update_${change.resource_type}`,
        action_payload: {
          resource_id: change.resource_id,
          field: change.field,
          value: change.proposed_value,
        },
        before_state: {
          resource_type: change.resource_type,
          resource_id: change.resource_id,
          field: change.field,
          value: change.current_value,
        },
        resource_type: change.resource_type,
        resource_id: change.resource_id,
        status: "processing" as const,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const actionId = (queueEntry as { id: string } | null)?.id;

    try {
      const resourceId = parseInt(change.resource_id, 10);

      switch (change.resource_type) {
        case "media":
          if (change.field === "alt_text") {
            await client.updateMediaItem(resourceId, {
              alt_text: change.proposed_value,
            });
          }
          break;

        case "page":
          if (change.field === "meta_description") {
            await client.updatePage(resourceId, {
              meta: { _yoast_wpseo_metadesc: change.proposed_value },
            } as Record<string, unknown>);
          } else {
            await client.updatePage(resourceId, {
              [change.field]: change.proposed_value,
            } as Record<string, unknown>);
          }
          break;

        case "post":
          if (change.field === "meta_description") {
            await client.updatePost(resourceId, {
              meta: { _yoast_wpseo_metadesc: change.proposed_value },
            } as Record<string, unknown>);
          } else {
            await client.updatePost(resourceId, {
              [change.field]: change.proposed_value,
            } as Record<string, unknown>);
          }
          break;

        case "menu_item":
          await client.createMenuItem({
            title: change.proposed_value,
            menus: resourceId,
          });
          break;

        default:
          throw new Error(`Unsupported resource type: ${change.resource_type}`);
      }

      // Mark completed
      if (actionId) {
        await supabase
          .from("wp_action_queue")
          .update({
            status: "completed" as const,
            after_state: {
              resource_type: change.resource_type,
              resource_id: change.resource_id,
              field: change.field,
              value: change.proposed_value,
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", actionId);
      }

      results.push({ change_id: change.id, success: true, action_id: actionId });
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

      results.push({
        change_id: change.id,
        success: false,
        error: (error as Error).message,
        action_id: actionId,
      });
    }
  }

  return NextResponse.json({ results });
}
