import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTokensFromCode,
  encryptToken,
  listGA4Properties,
  getGBPLocations,
  listGSCSites,
} from "@/lib/google";
import type { IntegrationType } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    // Helper to build redirect URL back to client detail page
    function clientUrl(clientId: string, params?: string) {
      const base = `/admin/clients/${clientId}`;
      return new URL(params ? `${base}?${params}` : base, request.url);
    }

    // Handle OAuth errors
    if (error) {
      console.error("Google OAuth error:", error);
      // No state to parse yet, fallback to clients list
      return NextResponse.redirect(
        new URL("/admin/clients", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/admin/clients", request.url)
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
      if (parsed.type !== "ga4" && parsed.type !== "gbp" && parsed.type !== "gsc") {
        throw new Error("Invalid integration type");
      }
      stateData = parsed;
    } catch {
      return NextResponse.redirect(
        new URL("/admin/clients", request.url)
      );
    }

    // Verify user matches
    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        clientUrl(stateData.clientId, "error=user_mismatch")
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
      // Get GBP locations (gracefully handle API errors)
      let locations: Awaited<ReturnType<typeof getGBPLocations>> = [];
      try {
        locations = await getGBPLocations(tokens.access_token);
      } catch (err) {
        console.error("Failed to fetch GBP locations:", err);
        // Still save integration — user can retry location fetch from settings
      }

      if (locations.length === 1) {
        // Auto-select if only one location
        accountId = locations[0]!.locationId;
        accountName = locations[0]!.locationName;
        metadata = { locations };
      } else {
        metadata = { locations, needsLocationSelection: true };
        accountId = "pending_selection";
        accountName = "Google Business Profile";
      }
    } else if (stateData.type === "gsc") {
      // Get Search Console sites
      let sites: Awaited<ReturnType<typeof listGSCSites>> = [];
      let gscError: string | null = null;
      try {
        sites = await listGSCSites(tokens.access_token);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to fetch GSC sites:", errMsg);
        gscError = errMsg;
      }

      if (sites.length === 1) {
        accountId = sites[0]!.siteUrl;
        accountName = sites[0]!.siteUrl;
        metadata = { sites };
      } else if (sites.length > 1) {
        metadata = { sites, needsSiteSelection: true };
        accountId = "pending_selection";
        accountName = "Google Search Console";
      } else {
        // No sites found or API error — still save tokens so user can retry
        metadata = { sites: [], needsSiteSelection: true, error: gscError || "No verified sites found" };
        accountId = "pending_selection";
        accountName = "Google Search Console";
      }
    }

    // Delete existing integration of this type for this client (to avoid unique constraint issues on reconnect)
    await adminClient
      .from("integrations")
      .delete()
      .eq("client_id", stateData.clientId)
      .eq("type", stateData.type);

    // Insert new integration record
    const { error: insertError } = await adminClient
      .from("integrations")
      .insert({
        client_id: stateData.clientId,
        type: stateData.type,
        account_id: accountId,
        account_name: accountName,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: new Date(tokens.expiry_date).toISOString(),
        metadata,
        is_active: true,
      });

    if (insertError) {
      console.error("Failed to save integration:", insertError);
      return NextResponse.redirect(
        clientUrl(stateData.clientId, "error=save_failed")
      );
    }

    // Redirect back to client detail page
    return NextResponse.redirect(
      clientUrl(stateData.clientId, `success=true&type=${stateData.type}`)
    );
  } catch (err) {
    console.error("Google callback error:", err instanceof Error ? err.message : err);
    console.error("Google callback error stack:", err instanceof Error ? err.stack : "no stack");
    return NextResponse.redirect(
      new URL("/admin/clients?error=callback_failed", request.url)
    );
  }
}
