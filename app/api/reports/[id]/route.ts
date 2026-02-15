import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/types/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get report record (RLS will filter by client access)
    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single<Report>();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Generate signed URL for download
    const { data: urlData, error: urlError } = await supabase.storage
      .from("reports")
      .createSignedUrl(report.file_path, 60 * 60); // 1 hour

    if (urlError || !urlData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download link" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      downloadUrl: urlData.signedUrl,
      report: {
        id: report.id,
        periodStart: report.period_start,
        periodEnd: report.period_end,
        generatedAt: report.generated_at,
        fileSize: report.file_size,
      },
    });
  } catch (err) {
    console.error("Report download error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to get report" },
      { status: 500 }
    );
  }
}
