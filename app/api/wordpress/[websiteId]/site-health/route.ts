import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { websiteId } = await params;

  try {
    const client = await WPClient.fromWebsiteId(websiteId);

    const [health, plugins] = await Promise.all([
      client.getSiteHealth(),
      client.getPlugins(),
    ]);

    // Cache the health check result
    const supabase = await createClient();
    const { data: website } = await supabase
      .from("websites")
      .select("client_id")
      .eq("id", websiteId)
      .single();

    if (website) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("id")
        .eq("client_id", website.client_id)
        .eq("type", "wordpress")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (integration) {
        await supabase
          .from("wordpress_credentials")
          .update({
            last_health_check: new Date().toISOString(),
            last_health_status: health as unknown as Record<string, unknown>,
          })
          .eq("integration_id", integration.id);
      }
    }

    return NextResponse.json({ health, plugins });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
