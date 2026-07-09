"use server";

import { logActivity } from "@/lib/actions/activity";
import { requireAdmin } from "@/lib/auth";
import { ActivityTypes } from "@/lib/constants/activity";
import { sendClientEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export async function sendEmailToClientAction(
    clientId: string,
    toEmail: string,
    subject: string,
    message: string,
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
        await logActivity({
            clientId,
            actionType: ActivityTypes.EMAIL_SENT,
            metadata: { clientId, email: toEmail, subject: subject.trim(), senderId: auth.userId },
        });
    }

    return result;
}
