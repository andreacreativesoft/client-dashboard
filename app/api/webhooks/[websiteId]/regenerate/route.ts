import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function generateApiKey(): string {
  return "wh_" + randomBytes(24).toString("base64url");
}

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/webhooks/[websiteId]/regenerate
 *
 * Called from WordPress admin to regenerate the webhook API key.
 * Auth: shared_secret must match the stored secret for the website's WordPress integration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const body = await request.json();
    const { shared_secret, site_url } = body;

    if (!shared_secret || !site_url) {
      return NextResponse.json(
        { success: false, error: "Missing shared_secret or site_url" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createAdminClient();

    // Find the website
    const { data: website } = await supabase
      .from("websites")
      .select("id, client_id, api_key")
      .eq("id", websiteId)
      .single();

    if (!website) {
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Find WordPress integration for this client
    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("client_id", website.client_id)
      .eq("type", "wordpress")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "WordPress integration not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Verify shared secret
    const { data: creds } = await supabase
      .from("wordpress_credentials")
      .select("shared_secret_encrypted")
      .eq("integration_id", integration.id)
      .single();

    if (!creds) {
      return NextResponse.json(
        { success: false, error: "Credentials not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Decrypt and compare the shared secret
    const { decryptToken } = await import("@/lib/google");
    const storedSecret = decryptToken(creds.shared_secret_encrypted);

    if (storedSecret !== shared_secret) {
      return NextResponse.json(
        { success: false, error: "Invalid shared secret" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const { error: updateError } = await supabase
      .from("websites")
      .update({ api_key: newApiKey })
      .eq("id", websiteId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update API key" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

    return NextResponse.json(
      {
        success: true,
        api_key: newApiKey,
        webhook_url: `${appUrl}/api/webhooks/lead?key=${newApiKey}`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Webhook regenerate error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
