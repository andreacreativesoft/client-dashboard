import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewLeadNotification } from "@/lib/email";
import { sendPushToMultiple, type PushSubscriptionData } from "@/lib/push";
import { sendFacebookConversion, FacebookEvents } from "@/lib/facebook";
import { decryptToken } from "@/lib/google";
import type { WebhookLeadPayload } from "@/types/api";
import type { Website } from "@/types/database";

function normalizeLead(body: WebhookLeadPayload) {
  // Handle various form plugin formats
  const combinedName = [body.first_name, body.last_name].filter(Boolean).join(" ");

  const name =
    body.name ||
    body.full_name ||
    body.your_name ||
    body.fields?.name ||
    body.fields?.your_name ||
    combinedName ||
    null;

  const email =
    body.email ||
    body.your_email ||
    body.fields?.email ||
    body.fields?.your_email ||
    null;

  const phone =
    body.phone ||
    body.tel ||
    body.telephone ||
    body.your_phone ||
    body.fields?.phone ||
    body.fields?.tel ||
    null;

  const message =
    body.message ||
    body.your_message ||
    body.comment ||
    body.fields?.message ||
    body.fields?.your_message ||
    null;

  return {
    name,
    email,
    phone,
    message,
    form_name: body.form_name || body.form_id || body.formName || null,
    raw_data: body as Record<string, unknown>,
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

    const body: WebhookLeadPayload = await request.json();

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
      { status: 201 }
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
