import webpush from "web-push";

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  leadId?: string;
  tag?: string;
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return { success: false, error: "Push notifications not configured" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (err) {
    console.error("Push notification error:", err);
    const error = err instanceof Error ? err.message : "Unknown error";

    // Check if subscription is expired/invalid
    if (error.includes("410") || error.includes("404")) {
      return { success: false, error: "subscription_expired" };
    }

    return { success: false, error };
  }
}

export async function sendPushToMultiple(
  subscriptions: PushSubscriptionData[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; expired: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );

  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.success) {
      sent++;
    } else {
      failed++;
      // Track expired subscriptions for cleanup
      if (
        result.status === "fulfilled" &&
        result.value.error === "subscription_expired"
      ) {
        expired.push(subscriptions[index]?.endpoint || "");
      }
    }
  });

  return { sent, failed, expired };
}

// Generate VAPID keys (run once, save to env)
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const keys = webpush.generateVAPIDKeys();
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}

// Import here to avoid circular dependency issues
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Send push notification to all users associated with a client
 */
export async function sendPushToClientUsers(
  clientId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notifications");
    return { sent: 0, failed: 0 };
  }

  const supabase = createAdminClient();

  // Get all users associated with this client
  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("user_id")
    .eq("client_id", clientId);

  const userIds: string[] = clientUsers?.map((cu) => cu.user_id) || [];

  // Also notify admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins) {
    for (const admin of admins) {
      if (!userIds.includes(admin.id)) {
        userIds.push(admin.id);
      }
    }
  }

  if (userIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Get push subscriptions for these users
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const pushSubs: PushSubscriptionData[] = subscriptions.map((s) => ({
    endpoint: s.endpoint,
    keys: {
      p256dh: s.p256dh,
      auth: s.auth,
    },
  }));

  const result = await sendPushToMultiple(pushSubs, payload);

  // Clean up expired subscriptions
  if (result.expired.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", result.expired);
  }

  return { sent: result.sent, failed: result.failed };
}

/**
 * Send new lead push notification
 */
export async function sendNewLeadPushNotification(
  clientId: string,
  leadName: string,
  leadId: string,
  websiteName: string
): Promise<void> {
  await sendPushToClientUsers(clientId, {
    title: "New Lead",
    body: `${leadName} from ${websiteName}`,
    url: `/leads/${leadId}`,
    leadId,
    tag: `lead-${leadId}`,
  });
}
