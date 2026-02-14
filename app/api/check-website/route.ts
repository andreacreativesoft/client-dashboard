import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { websiteId } = await request.json();
  if (!websiteId) {
    return NextResponse.json({ error: "Missing websiteId" }, { status: 400 });
  }

  // Get the website
  const { data: website } = await supabase
    .from("websites")
    .select("id, url, content_hash")
    .eq("id", websiteId)
    .single();

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  // Fetch the live website content
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(website.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ClientDashboard-ChangeDetector/1.0",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({
        error: `Website returned ${response.status}`,
        checked: true,
        reachable: false,
      });
    }

    const html = await response.text();

    // Hash the content (strip dynamic elements like nonces, timestamps)
    const cleaned = html
      .replace(/nonce="[^"]*"/g, "")
      .replace(/\d{10,13}/g, "") // timestamps
      .replace(/<!--.*?-->/gs, "") // comments
      .replace(/\s+/g, " ") // normalize whitespace
      .trim();

    const newHash = crypto
      .createHash("sha256")
      .update(cleaned)
      .digest("hex");

    const previousHash = website.content_hash;
    const hasChanges = previousHash !== null && previousHash !== newHash;

    // Update the website record
    const adminClient = createAdminClient();
    await adminClient
      .from("websites")
      .update({
        content_hash: newHash,
        last_checked_at: new Date().toISOString(),
        has_changes: hasChanges,
      })
      .eq("id", websiteId);

    return NextResponse.json({
      checked: true,
      reachable: true,
      hasChanges,
      isFirstCheck: previousHash === null,
      lastCheckedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch";
    return NextResponse.json({
      error: `Could not reach website: ${message}`,
      checked: true,
      reachable: false,
    });
  }
}
