import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateClientReport, generateAllMonthlyReports } from "@/lib/reports/generate";
import { getLastMonthPeriod } from "@/lib/reports/gather-data";
import { startOfMonth, endOfMonth, parse } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, period, sendEmail, generateAll } = body as {
      clientId?: string;
      period?: string; // "YYYY-MM" format
      sendEmail?: boolean;
      generateAll?: boolean;
    };

    // Parse period or use last month
    let periodStart: Date;
    let periodEnd: Date;

    if (period) {
      const date = parse(period, "yyyy-MM", new Date());
      periodStart = startOfMonth(date);
      periodEnd = endOfMonth(date);
    } else {
      const lastMonth = getLastMonthPeriod();
      periodStart = lastMonth.start;
      periodEnd = lastMonth.end;
    }

    // Generate all reports or single client
    if (generateAll) {
      const result = await generateAllMonthlyReports({ sendEmail });
      return NextResponse.json(result);
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId or generateAll required" },
        { status: 400 }
      );
    }

    const result = await generateClientReport(clientId, periodStart, periodEnd, {
      sendEmail,
    });

    if (result.success) {
      return NextResponse.json({ success: true, reportId: result.reportId });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
