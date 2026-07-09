import { sendClientEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export type TicketReplyNotificationData = {
    ticketId: string;
    clientId: string;
    ticketNumber: number | string;
    subject: string;
    /** Body of the agency reply (plain text). */
    content: string;
    /** Display name of the replying admin. */
    authorName: string;
    /** Author's user id — excluded from recipients. */
    authorId: string;
};

/**
 * Notifie les utilisateurs du client qu'une réponse (non-interne) a été postée
 * sur leur demande par l'agence. Best-effort : les erreurs sont avalées.
 */
export async function sendTicketReplyNotification(
    data: TicketReplyNotificationData,
): Promise<void> {
    try {
        const supabase = createAdminClient();
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const { data: clientUsers } = await supabase
            .from("client_users")
            .select("user_id")
            .eq("client_id", data.clientId);

        const userIds = (clientUsers || [])
            .map((cu) => cu.user_id)
            .filter((id) => id !== data.authorId);
        if (userIds.length === 0) return;

        const { data: profiles } = await supabase
            .from("profiles")
            .select("email")
            .in("id", userIds);

        const recipients = (profiles || []).map((p) => p.email).filter((e): e is string => !!e);
        if (recipients.length === 0) return;

        const ticketUrl = `${baseUrl}/tickets/${data.ticketId}`;
        const subject = `Réponse à votre demande #${data.ticketNumber} — ${data.subject}`;
        const message = `${data.content}\n\nVoir la demande : ${ticketUrl}`;

        await Promise.all(
            recipients.map((email) =>
                sendClientEmail(email, subject, message, data.authorName || "Votre Site Pro"),
            ),
        );
    } catch (err) {
        console.error("Error sending ticket reply notifications:", err);
    }
}
