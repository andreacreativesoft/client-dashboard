import crypto from "crypto";

const FACEBOOK_API_VERSION = "v18.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

export interface FacebookConfig {
  pixelId: string;
  accessToken: string;
  testEventCode?: string; // For testing in Events Manager
}

export interface FacebookEventData {
  eventName: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource: "website" | "email" | "app" | "phone_call" | "chat" | "other";
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbp?: string; // Facebook browser ID
    fbc?: string; // Facebook click ID
  };
  customData?: Record<string, unknown>;
}

// Hash user data for privacy (required by Facebook)
function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  return phone.replace(/\D/g, "");
}

function prepareUserData(userData: FacebookEventData["userData"]) {
  const prepared: Record<string, string> = {};

  if (userData.email) {
    prepared.em = hashValue(userData.email);
  }
  if (userData.phone) {
    prepared.ph = hashValue(normalizePhone(userData.phone));
  }
  if (userData.firstName) {
    prepared.fn = hashValue(userData.firstName);
  }
  if (userData.lastName) {
    prepared.ln = hashValue(userData.lastName);
  }
  if (userData.city) {
    prepared.ct = hashValue(userData.city);
  }
  if (userData.state) {
    prepared.st = hashValue(userData.state);
  }
  if (userData.country) {
    prepared.country = hashValue(userData.country);
  }
  if (userData.zipCode) {
    prepared.zp = hashValue(userData.zipCode);
  }
  if (userData.clientIpAddress) {
    prepared.client_ip_address = userData.clientIpAddress;
  }
  if (userData.clientUserAgent) {
    prepared.client_user_agent = userData.clientUserAgent;
  }
  if (userData.fbp) {
    prepared.fbp = userData.fbp;
  }
  if (userData.fbc) {
    prepared.fbc = userData.fbc;
  }

  return prepared;
}

export async function sendFacebookConversion(
  config: FacebookConfig,
  eventData: FacebookEventData
): Promise<{ success: boolean; error?: string; eventId?: string }> {
  try {
    const eventId = crypto.randomUUID();

    const payload = {
      data: [
        {
          event_name: eventData.eventName,
          event_time: eventData.eventTime || Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventData.eventSourceUrl,
          action_source: eventData.actionSource,
          user_data: prepareUserData(eventData.userData),
          custom_data: eventData.customData,
        },
      ],
      ...(config.testEventCode && { test_event_code: config.testEventCode }),
    };

    const response = await fetch(
      `${FACEBOOK_GRAPH_URL}/${config.pixelId}/events?access_token=${config.accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Facebook Conversions API error:", result);
      return {
        success: false,
        error: result.error?.message || "Failed to send conversion",
      };
    }

    return {
      success: true,
      eventId,
    };
  } catch (err) {
    console.error("Facebook conversion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Predefined event names
export const FacebookEvents = {
  LEAD: "Lead",
  CONTACT: "Contact",
  COMPLETE_REGISTRATION: "CompleteRegistration",
  SUBMIT_APPLICATION: "SubmitApplication",
  PURCHASE: "Purchase",
  ADD_TO_CART: "AddToCart",
  INITIATE_CHECKOUT: "InitiateCheckout",
  SEARCH: "Search",
  VIEW_CONTENT: "ViewContent",
  ADD_PAYMENT_INFO: "AddPaymentInfo",
  ADD_TO_WISHLIST: "AddToWishlist",
  SCHEDULE: "Schedule",
  START_TRIAL: "StartTrial",
  SUBSCRIBE: "Subscribe",
  CUSTOM: "CustomEvent",
} as const;

export type FacebookEventName = (typeof FacebookEvents)[keyof typeof FacebookEvents];
