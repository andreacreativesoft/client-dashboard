import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTokensFromCode,
  encryptToken,
  listGA4Properties,
  getGBPLocations,
} from "@/lib/google";
import type { IntegrationType } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL("/admin/integrations?error=oauth_denied", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/admin/integrations?error=missing_params", request.url)
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Parse state
    let stateData: { clientId: string; userId: string; type: IntegrationType };
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64").toString());
      if (parsed.type !== "ga4" && parsed.type !== "gbp") {
        throw new Error("Invalid integration type");
      }
      stateData = parsed;
    } catch {
      return NextResponse.redirect(
        new URL("/admin/integrations?error=invalid_state", request.url)
      );
    }

    // Verify user matches
    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL("/admin/integrations?error=user_mismatch", request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Encrypt tokens for storage
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // Depending on integration type, get account info
    const adminClient = createAdminClient();
    let accountId = "";
    let accountName = "";
    let metadata: Record<string, unknown> = {};

    if (stateData.type === "ga4") {
      // Get GA4 properties for user to select
      const properties = await listGA4Properties(tokens.access_token);

      // For now, just store that we have access - user will select property later
      metadata = { properties, needsPropertySelection: true };
      accountId = "pending_selection";
      accountName = "Google Analytics";
    } else if (stateData.type === "gbp") {
      // Get GBP locations
      const locations = await getGBPLocations(tokens.access_token);

      metadata = { locations, needsLocationSelection: true };
      accountId = "pending_selection";
      accountName = "Google Business Profile";
    }

    // Upsert integration record
    const { error: upsertError } = await adminClient
      .from("integrations")
      .upsert(
        {
          client_id: stateData.clientId,
          type: stateData.type,
          account_id: accountId,
          account_name: accountName,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          token_expires_at: new Date(tokens.expiry_date).toISOString(),
          metadata,
          is_active: true,
        },
        {
          onConflict: "client_id,type,account_id",
        }
      );

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      return NextResponse.redirect(
        new URL("/admin/integrations?error=save_failed", request.url)
      );
    }

    // Redirect to integrations page with success
    return NextResponse.redirect(
      new URL(
        `/admin/integrations?success=true&type=${stateData.type}&client_id=${stateData.clientId}`,
        request.url
      )
    );
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(
      new URL("/admin/integrations?error=callback_failed", request.url)
    );
  }
}
