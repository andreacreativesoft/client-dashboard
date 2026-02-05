import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookLeadPayload } from "@/types/api";
import type { Website, Lead } from "@/types/database";

function normalizeLead(body: WebhookLeadPayload) {
  return {
    name:
      body.name ||
      body.full_name ||
      body.fields?.name ||
      "Unknown",
    email:
      body.email ||
      body.fields?.email ||
      null,
    phone:
      body.phone ||
      body.tel ||
      body.fields?.phone ||
      null,
    message:
      body.message ||
      body.fields?.message ||
      null,
    form_name:
      body.form_name ||
      body.form_id ||
      null,
    raw_data: body as Record<string, unknown>,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing x-api-key header" },
        { status: 401 }
      );
    }

    const body: WebhookLeadPayload = await request.json();

    // Use admin client (bypasses RLS) to look up website by API key
    const supabase = createAdminClient();

    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .select("id, client_id, is_active")
      .eq("api_key", apiKey)
      .single<Pick<Website, "id" | "client_id" | "is_active">>();

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

    // Normalize and insert lead
    const normalized = normalizeLead(body);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        website_id: website.id,
        form_name: normalized.form_name,
        source: "webhook" as const,
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        message: normalized.message,
        raw_data: normalized.raw_data,
        status: "new" as const,
      })
      .select("id")
      .single<Pick<Lead, "id">>();

    if (leadError) {
      console.error("Failed to insert lead:", leadError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, lead_id: lead.id },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
