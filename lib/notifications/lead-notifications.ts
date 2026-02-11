import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewLeadNotification } from "@/lib/email";
import { sendPushToMultiple, type PushSubscriptionData } from "@/lib/push";
import { sendFacebookConversion, FacebookEvents } from "@/lib/facebook";
import { decryptToken } from "@/lib/google";

/** Data about a newly created lead for notification dispatch */
export type NewLeadNotificationData = {
  leadId: string;
  clientId: string;
  clientName: string;
  websiteName: string;
  websiteUrl: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  formName: string | null;
};

/**
 * Send all notifications for a new lead (email, push, Facebook).
 * All notifications are fire-and-forget (non-blocking).
 * Errors are logged but never thrown.
 */
export async function sendNewLeadNotifications(data: NewLeadNotificationData): Promise<void> {
  const supabase = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get users associated with this client
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("user_id")
    .eq("client_id", data.clientId);

  if (clientUsers && clientUsers.length > 0) {
    const userIds = clientUsers.map((cu) => cu.user_id);

    // Send emails and push in parallel (fire-and-forget)
    sendEmailNotifications(supabase, userIds, data, baseUrl);
    sendPushNotifications(supabase, userIds, data, baseUrl);
  }

  // Send Facebook Conversion if configured (fire-and-forget)
  sendFbConversion(supabase, data);
}

/** Send email notifications to all users linked to the client */
async function sendEmailNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  data: NewLeadNotificationData,
  baseUrl: string
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
          dashboardUrl: `${baseUrl}/leads/${data.leadId}`,
        })
      );

    await Promise.all(emailPromises);
  } catch (err) {
    console.error("Error sending notification emails:", err);
  }
}

/** Send push notifications to all subscribed users */
async function sendPushNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  data: NewLeadNotificationData,
  baseUrl: string
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

    await sendPushToMultiple(subscriptions, {
      title: `New Lead: ${data.name || "Unknown"}`,
      body: `${data.websiteName} - ${data.email || data.phone || "No contact info"}`,
      url: `${baseUrl}/leads/${data.leadId}`,
      leadId: data.leadId,
      tag: `lead-${data.leadId}`,
    });
  } catch (err) {
    console.error("Error sending push notifications:", err);
  }
}

/** Send Facebook Conversion API event if configured */
async function sendFbConversion(
  supabase: ReturnType<typeof createAdminClient>,
  data: NewLeadNotificationData
): Promise<void> {
  try {
    const { data: fbIntegration } = await supabase
      .from("integrations")
      .select("account_id, access_token_encrypted, metadata")
      .eq("client_id", data.clientId)
      .eq("type", "facebook")
      .eq("is_active", true)
      .single<{
        account_id: string;
        access_token_encrypted: string | null;
        metadata: Record<string, unknown> | null;
      }>();

    if (!fbIntegration?.access_token_encrypted) return;

    const accessToken = decryptToken(fbIntegration.access_token_encrypted);
    const testEventCode = fbIntegration.metadata?.test_event_code as string | undefined;

    // Parse name into first/last
    const nameParts = (data.name || "").split(" ");
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    await sendFacebookConversion(
      {
        pixelId: fbIntegration.account_id,
        accessToken,
        testEventCode,
      },
      {
        eventName: FacebookEvents.LEAD,
        actionSource: "website",
        eventSourceUrl: data.websiteUrl,
        userData: {
          email: data.email || undefined,
          phone: data.phone || undefined,
          firstName,
          lastName,
        },
        customData: {
          lead_id: data.leadId,
          form_name: data.formName,
          website_name: data.websiteName,
        },
      }
    );
  } catch (err) {
    console.error("Error sending Facebook conversion:", err);
  }
}
