import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron endpoint: cleans up stale analytics cache entries.
 * Deletes cache rows older than 24 hours.
 *
 * Secured by CRON_SECRET — Vercel Cron automatically sends this header.
 * Can also be triggered manually with: GET /api/cron/cleanup-cache
 * with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends it automatically for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Delete analytics cache entries older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("analytics_cache")
      .delete()
      .lt("fetched_at", cutoff)
      .select("id");

    if (error) {
      console.error("Cache cleanup error:", error.message);
      return NextResponse.json(
        { error: "Cleanup failed", details: error.message },
        { status: 500 }
      );
    }

    const deletedCount = data?.length || 0;
    console.log(`Cache cleanup: deleted ${deletedCount} stale entries`);

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      cutoff,
    });
  } catch (err) {
    console.error("Cache cleanup error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
