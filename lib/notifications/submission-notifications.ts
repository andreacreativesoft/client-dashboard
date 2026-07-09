import { sendNewLeadNotification } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export type NewSubmissionNotificationData = {
    submissionId: string;
    clientId: string;
    clientName: string;
    websiteName: string;
    websiteUrl: string;
    /** Libellé humain du connecteur d'origine ("Prospect" / "Formulaire" / …). */
    submissionLabel: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    formName: string | null;
};

export async function sendNewSubmissionNotifications(
    data: NewSubmissionNotificationData,
): Promise<void> {
    const supabase = createAdminClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { data: clientUsers } = await supabase
        .from("client_users")
        .select("user_id")
        .eq("client_id", data.clientId);

    if (!clientUsers || clientUsers.length === 0) return;

    const userIds = clientUsers.map((cu) => cu.user_id);

    await sendEmailNotifications(supabase, userIds, data, baseUrl);
}

async function sendEmailNotifications(
    supabase: ReturnType<typeof createAdminClient>,
    userIds: string[],
    data: NewSubmissionNotificationData,
    baseUrl: string,
): Promise<void> {
    try {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("email")
            .in("id", userIds);

        if (!profiles) return;

        const emailPromises = profiles
            .filter((p) => p.email)
            .map((p) =>
                sendNewLeadNotification(p.email, {
                    clientName: data.clientName,
                    websiteName: data.websiteName,
                    leadName: data.name || "Unknown",
                    leadEmail: data.email || "No email provided",
                    leadPhone: data.phone,
                    formName: data.formName,
                    message: data.message,
                    submittedAt: new Date().toLocaleString(),
                    dashboardUrl: `${baseUrl}/submissions/${data.submissionId}`,
                }),
            );

        await Promise.all(emailPromises);
    } catch (err) {
        console.error("Error sending notification emails:", err);
    }
}
