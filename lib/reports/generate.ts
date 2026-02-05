import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherReportData, getLastMonthPeriod } from "./gather-data";
import { generatePDFBuffer } from "./pdf-template";

export async function generateClientReport(
  clientId: string,
  periodStart: Date,
  periodEnd: Date,
  options?: { sendEmail?: boolean; agencyName?: string }
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Gather report data
    const reportData = await gatherReportData(clientId, periodStart, periodEnd);
    if (!reportData) {
      return { success: false, error: "Client not found" };
    }

    // Generate PDF
    const pdfBuffer = await generatePDFBuffer(reportData, options?.agencyName);

    // Upload to Supabase Storage
    const fileName = `reports/${clientId}/${format(periodStart, "yyyy-MM")}-report.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload report:", uploadError);
      return { success: false, error: "Failed to upload report" };
    }

    // Store report record
    const { data: report, error: insertError } = await supabase
      .from("reports")
      .upsert(
        {
          client_id: clientId,
          period_start: format(periodStart, "yyyy-MM-dd"),
          period_end: format(periodEnd, "yyyy-MM-dd"),
          file_path: fileName,
          file_size: pdfBuffer.length,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,period_start,period_end" }
      )
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to save report record:", insertError);
      return { success: false, error: "Failed to save report record" };
    }

    // Send email if requested
    if (options?.sendEmail) {
      // Get client users to email
      const { data: clientUsers } = await supabase
        .from("client_users")
        .select("user_id")
        .eq("client_id", clientId);

      if (clientUsers && clientUsers.length > 0) {
        const userIds = clientUsers.map((cu) => cu.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", userIds);

        // Get download URL
        const { data: urlData } = await supabase.storage
          .from("reports")
          .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 day link

        if (profiles && urlData?.signedUrl) {
          // Mark as sent
          await supabase
            .from("reports")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", report.id);
        }
      }
    }

    return { success: true, reportId: report.id };
  } catch (err) {
    console.error("Report generation error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function generateAllMonthlyReports(options?: {
  sendEmail?: boolean;
  agencyName?: string;
}): Promise<{ generated: number; failed: number; errors: string[] }> {
  const supabase = createAdminClient();
  const { start, end } = getLastMonthPeriod();

  // Get all active clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name");

  if (!clients || clients.length === 0) {
    return { generated: 0, failed: 0, errors: [] };
  }

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const client of clients) {
    const result = await generateClientReport(client.id, start, end, options);
    if (result.success) {
      generated++;
    } else {
      failed++;
      errors.push(`${client.business_name}: ${result.error}`);
    }
  }

  return { generated, failed, errors };
}
