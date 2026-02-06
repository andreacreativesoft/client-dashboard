import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewLeadNotification } from "@/lib/email";
import { sendPushToMultiple, type PushSubscriptionData } from "@/lib/push";
import { sendFacebookConversion, FacebookEvents } from "@/lib/facebook";
import { decryptToken } from "@/lib/google";
import { rateLimit } from "@/lib/rate-limit";
import type { WebhookLeadPayload } from "@/types/api";
import type { Website } from "@/types/database";

// Rate limit: 30 requests per minute per API key, 60 per minute per IP
const RATE_LIMIT_PER_KEY = { windowMs: 60_000, maxRequests: 30 };
const RATE_LIMIT_PER_IP = { windowMs: 60_000, maxRequests: 60 };

/** Truncate and strip control characters from a string value */
function sanitize(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str.length === 0) return null;
  // Strip control characters (except newlines/tabs in messages)
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.slice(0, maxLength) || null;
}

/** Validate email format loosely (no need to be RFC-perfect for leads) */
function sanitizeEmail(value: unknown): string | null {
  const email = sanitize(value, 255);
  if (!email) return null;
  // Basic email format check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null;
}

/** Strip non-phone characters, keep digits and common phone symbols */
function sanitizePhone(value: unknown): string | null {
  const phone = sanitize(value, 50);
  if (!phone) return null;
  // Keep digits, +, -, (, ), spaces, dots
  const cleaned = phone.replace(/[^\d+\-().  ]/g, "");
  // Must have at least 6 digits to be a phone number
  const digitCount = cleaned.replace(/\D/g, "").length;
  return digitCount >= 6 ? cleaned : null;
}

function normalizeLead(body: WebhookLeadPayload) {
  // Handle various form plugin formats
  const combinedName = [body.first_name, body.last_name].filter(Boolean).join(" ");

  const name = sanitize(
    body.name ||
    body.full_name ||
    body.your_name ||
    body.fields?.name ||
    body.fields?.your_name ||
    combinedName,
    255
  );

  const email = sanitizeEmail(
    body.email ||
    body.your_email ||
    body.fields?.email ||
    body.fields?.your_email
  );

  const phone = sanitizePhone(
    body.phone ||
    body.tel ||
    body.telephone ||
    body.your_phone ||
    body.fields?.phone ||
    body.fields?.tel
  );

  const message = sanitize(
    body.message ||
    body.your_message ||
    body.comment ||
    body.fields?.message ||
    body.fields?.your_message,
    5000
  );

  const form_name = sanitize(
    body.form_name || body.form_id || body.formName,
    255
  );

  // Sanitize raw_data: limit total size to prevent oversized payloads
  const rawJson = JSON.stringify(body);
  const raw_data = rawJson.length > 50_000
    ? { _truncated: true, _original_size: rawJson.length }
    : (body as Record<string, unknown>);

  return {
    name,
    email,
    phone,
    message,
    form_name,
    raw_data,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header OR query param (support both for flexibility)
    const apiKey =
      request.headers.get("x-api-key") ||
      request.nextUrl.searchParams.get("key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Provide x-api-key header or ?key= query param" },
        { status: 401 }
      );
    }

    // Rate limit by IP address
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipLimit = rateLimit(`ip:${ip}`, RATE_LIMIT_PER_IP);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Rate limit by API key
    const keyLimit = rateLimit(`key:${apiKey}`, RATE_LIMIT_PER_KEY);
    if (!keyLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests for this API key" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((keyLimit.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate body is an object and not too large
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const body = rawBody as WebhookLeadPayload;

    // Use admin client (bypasses RLS) to look up website by API key
    const supabase = createAdminClient();

    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .select("id, client_id, name, url, is_active")
      .eq("api_key", apiKey)
      .single<Pick<Website, "id" | "client_id" | "name" | "url" | "is_active">>();

    if (websiteError || !website) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    if (!website.is_active) {
      return NextResponse.json(
        { error: "Website is inactive" },
        { status: 403 }
      );
    }

    // Get client name for email
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", website.client_id)
      .single<{ name: string }>();

    // Normalize and insert lead
    const normalized = normalizeLead(body);

    const leadInsert = {
      website_id: website.id,
      client_id: website.client_id, // Denormalized for query performance
      form_name: normalized.form_name,
      source: "webhook" as const,
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      message: normalized.message,
      raw_data: normalized.raw_data,
      status: "new" as const,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: leadError } = await (supabase as any)
      .from("leads")
      .insert(leadInsert)
      .select("id")
      .single();

    if (leadError) {
      console.error("Failed to insert lead:", leadError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    // Send email notifications (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Get users associated with this client who have email notifications enabled
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", website.client_id);

    if (clientUsers && clientUsers.length > 0) {
      const userIds = clientUsers.map((cu) => cu.user_id);

      // Get emails for these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", userIds);

      if (profiles) {
        const emailPromises = profiles
          .filter((p) => p.email)
          .map((p) =>
            sendNewLeadNotification(p.email, {
              clientName: client?.name || "Client",
              websiteName: website.name,
              leadName: normalized.name || "Unknown",
              leadEmail: normalized.email || "No email provided",
              leadPhone: normalized.phone,
              formName: normalized.form_name,
              message: normalized.message,
              submittedAt: new Date().toLocaleString(),
              dashboardUrl: `${baseUrl}/leads/${lead.id}`,
            })
          );

        // Send all emails in parallel (don't await to avoid slowing response)
        Promise.all(emailPromises).catch((err) => {
          console.error("Error sending notification emails:", err);
        });
      }

      // Send push notifications
      const { data: pushSubscriptions } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", userIds);

      if (pushSubscriptions && pushSubscriptions.length > 0) {
        const subscriptions: PushSubscriptionData[] = pushSubscriptions.map((sub) => ({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }));

        sendPushToMultiple(subscriptions, {
          title: `New Lead: ${normalized.name || "Unknown"}`,
          body: `${website.name} - ${normalized.email || normalized.phone || "No contact info"}`,
          url: `${baseUrl}/leads/${lead.id}`,
          leadId: lead.id,
          tag: `lead-${lead.id}`,
        }).catch((err) => {
          console.error("Error sending push notifications:", err);
        });
      }
    }

    // Send Facebook Conversion if configured
    const { data: fbIntegration } = await supabase
      .from("integrations")
      .select("account_id, access_token_encrypted, metadata")
      .eq("client_id", website.client_id)
      .eq("type", "facebook")
      .eq("is_active", true)
      .single<{
        account_id: string;
        access_token_encrypted: string | null;
        metadata: Record<string, unknown> | null;
      }>();

    if (fbIntegration?.access_token_encrypted) {
      const accessToken = decryptToken(fbIntegration.access_token_encrypted);
      const testEventCode = fbIntegration.metadata?.test_event_code as string | undefined;

      // Parse name into first/last
      const nameParts = (normalized.name || "").split(" ");
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(" ") || undefined;

      sendFacebookConversion(
        {
          pixelId: fbIntegration.account_id,
          accessToken,
          testEventCode,
        },
        {
          eventName: FacebookEvents.LEAD,
          actionSource: "website",
          eventSourceUrl: website.url,
          userData: {
            email: normalized.email || undefined,
            phone: normalized.phone || undefined,
            firstName,
            lastName,
          },
          customData: {
            lead_id: lead.id,
            form_name: normalized.form_name,
            website_name: website.name,
          },
        }
      ).catch((err) => {
        console.error("Error sending Facebook conversion:", err);
      });
    }

    return NextResponse.json(
      { success: true, lead_id: lead.id },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(keyLimit.remaining),
        },
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// Also handle GET for testing the endpoint
export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("key");

  if (!apiKey) {
    return NextResponse.json({
      status: "ok",
      message: "Lead webhook endpoint. POST JSON data with API key to submit leads.",
      usage: {
        method: "POST",
        auth: "Provide API key via x-api-key header or ?key= query param",
        body: {
          name: "Contact name",
          email: "Contact email",
          phone: "Contact phone",
          message: "Message content",
          form_name: "Optional form identifier",
        },
      },
    });
  }

  // If key provided, verify it exists
  const supabase = createAdminClient();
  const { data: website } = await supabase
    .from("websites")
    .select("name, is_active")
    .eq("api_key", apiKey)
    .single<{ name: string; is_active: boolean }>();

  if (!website) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    website: website.name,
    active: website.is_active,
    message: "API key valid. Ready to receive leads via POST.",
  });
}
