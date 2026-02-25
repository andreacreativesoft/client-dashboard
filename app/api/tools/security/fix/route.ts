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
 * GET — fetch current security hardening status for a website.
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

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const status = await client.securityStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to fetch security status",
      },
      { status: 500 }
    );
  }
}
