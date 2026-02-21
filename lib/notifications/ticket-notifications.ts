import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToMultiple, type PushSubscriptionData } from "@/lib/push";

export type NewTicketNotificationData = {
  ticketId: string;
  clientId: string;
  clientName: string;
  subject: string;
  createdByName: string;
  priority: string;
  category: string;
};

export type TicketReplyNotificationData = {
  ticketId: string;
  clientId: string;
  clientName: string;
  subject: string;
  replierName: string;
  replyPreview: string;
};

/**
 * Send notifications when a new ticket is created.
 * Notifies all admins via push.
 */
export async function sendNewTicketNotifications(data: NewTicketNotificationData): Promise<void> {
  const supabase = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Notify all admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!admins || admins.length === 0) return;

  const adminIds = admins.map((a) => a.id);
  await sendPushNotificationsToUsers(supabase, adminIds, {
    title: `New Ticket: ${data.subject}`,
    body: `${data.createdByName} - ${data.clientName} [${data.priority}]`,
    url: `${baseUrl}/tickets/${data.ticketId}`,
    tag: `ticket-${data.ticketId}`,
  });
}

/**
 * Send notifications when a reply is added to a ticket.
 * Notifies relevant users (admins + client users) via push.
 */
export async function sendTicketReplyNotifications(data: TicketReplyNotificationData): Promise<void> {
  const supabase = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get users associated with this client + all admins
  const [clientUsersResult, adminsResult] = await Promise.all([
    supabase.from("client_users").select("user_id").eq("client_id", data.clientId),
    supabase.from("profiles").select("id").eq("role", "admin"),
  ]);

  const userIds = new Set<string>();
  if (clientUsersResult.data) {
    for (const cu of clientUsersResult.data) {
      userIds.add(cu.user_id);
    }
  }
  if (adminsResult.data) {
    for (const admin of adminsResult.data) {
      userIds.add(admin.id);
    }
  }

  if (userIds.size === 0) return;

  await sendPushNotificationsToUsers(supabase, Array.from(userIds), {
    title: `Reply on: ${data.subject}`,
    body: `${data.replierName}: ${data.replyPreview}`,
    url: `${baseUrl}/tickets/${data.ticketId}`,
    tag: `ticket-reply-${data.ticketId}`,
  });
}

async function sendPushNotificationsToUsers(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: { title: string; body: string; url: string; tag: string }
): Promise<void> {
  try {
    const { data: pushSubscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (!pushSubscriptions || pushSubscriptions.length === 0) return;

    const subscriptions: PushSubscriptionData[] = pushSubscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }));

    await sendPushToMultiple(subscriptions, payload);
  } catch (err) {
    console.error("Error sending ticket push notifications:", err);
  }
}
