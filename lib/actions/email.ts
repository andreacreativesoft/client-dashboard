"use server";

import { requireAdmin } from "@/lib/auth";
import { sendClientEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export async function sendEmailToClientAction(
  clientId: string,
  toEmail: string,
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return auth;

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: "Subject and message are required" };
  }

  // Get sender name from profile
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .single();

  const senderName = profile?.full_name || "Admin";

  const result = await sendClientEmail(toEmail, subject.trim(), message.trim(), senderName);

  if (result.success) {
    // Log activity
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.from("activity_logs").insert({
      client_id: clientId,
      user_id: auth.userId,
      action: "email_sent",
      description: `Sent email to ${toEmail}: "${subject.trim()}"`,
    });
  }

  return result;
}
