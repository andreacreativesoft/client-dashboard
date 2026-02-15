import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile";
import { decryptToken } from "@/lib/google";
import { google } from "googleapis";

export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Find any GBP integration
    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("type", "gbp")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!integration) {
      return NextResponse.json({ error: "No GBP integration found" });
    }

    const integrationData = integration as Record<string, unknown>;
    const accessToken = decryptToken(integrationData.access_token_encrypted as string);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Step 1: List accounts
    const mybusiness = google.mybusinessaccountmanagement({
      version: "v1",
      auth: oauth2Client,
    });

    let accountsData;
    try {
      const accountsResponse = await mybusiness.accounts.list();
      accountsData = accountsResponse.data;
    } catch (err) {
      return NextResponse.json({
        step: "accounts.list",
        error: err instanceof Error ? err.message : String(err),
        hint: "My Business Account Management API may not be enabled",
      });
    }

    const accounts = accountsData.accounts || [];

    // Step 2: For each account, list locations
    const results = [];
    for (const account of accounts) {
      if (!account.name) continue;

      const businessInfo = google.mybusinessbusinessinformation({
        version: "v1",
        auth: oauth2Client,
      });

      try {
        const locationsResponse = await businessInfo.accounts.locations.list({
          parent: account.name,
          readMask: "name,title",
        });
        results.push({
          account: { name: account.name, accountName: account.accountName, type: account.type },
          locations: locationsResponse.data.locations || [],
          locationsCount: (locationsResponse.data.locations || []).length,
        });
      } catch (err) {
        results.push({
          account: { name: account.name, accountName: account.accountName, type: account.type },
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      accountsCount: accounts.length,
      accounts: accounts.map(a => ({ name: a.name, accountName: a.accountName, type: a.type })),
      locationResults: results,
      integrationId: integrationData.id,
      metadata: integrationData.metadata,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
