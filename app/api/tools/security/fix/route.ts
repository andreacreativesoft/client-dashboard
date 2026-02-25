import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { WPClient } from "@/lib/wordpress/wp-client";

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await rateLimit(`tools:security-fix:${ip}`, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { websiteId, fixes } = body as {
    websiteId: string;
    fixes: string[];
  };

  if (!websiteId || !fixes || !Array.isArray(fixes) || fixes.length === 0) {
    return NextResponse.json(
      { error: "websiteId and fixes[] required" },
      { status: 400 }
    );
  }

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const result = await client.securityHarden(fixes);

    return NextResponse.json({
      success: result.success,
      applied: result.applied,
      failed: result.failed,
      skipped: result.skipped,
      active_fixes: result.active_fixes,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to apply security fixes",
      },
      { status: 500 }
    );
  }
}

/**
 * GET — check if a website has a WordPress connection and fetch active fixes.
 * First checks the DB for an active WordPress integration (fast, no remote call).
 * Then optionally tries to get active fixes from the remote site.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const websiteId = request.nextUrl.searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json(
      { error: "websiteId required" },
      { status: 400 }
    );
  }

  // Step 1: Check if this website's client has an active WordPress integration (DB only)
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    return NextResponse.json(
      { success: false, error: "Website not found" },
      { status: 404 }
    );
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("client_id", website.client_id)
    .eq("type", "wordpress")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!integration) {
    // No WordPress integration — Fix buttons should not be shown
    return NextResponse.json({ success: false, wp_connected: false });
  }

  // Step 2: WordPress integration exists — try to get active fixes from remote
  let active_fixes: string[] = [];
  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const status = await client.securityStatus();
    active_fixes = status.active_fixes || [];
  } catch {
    // Remote call failed (old mu-plugin version, site down, etc.)
    // Still show Fix buttons — the fix attempt will report errors
  }

  return NextResponse.json({
    success: true,
    wp_connected: true,
    active_fixes,
  });
}
