import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get client_id from query param (required to know which client to connect)
    const clientId = request.nextUrl.searchParams.get("client_id");
    const integrationType = request.nextUrl.searchParams.get("type") || "ga4";

    if (!clientId) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    // Create state for OAuth callback
    const state = Buffer.from(
      JSON.stringify({
        clientId,
        userId: user.id,
        type: integrationType,
      })
    ).toString("base64");

    const authUrl = getAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Google auth error:", err);
    return NextResponse.json(
      { error: "Failed to initiate Google auth" },
      { status: 500 }
    );
  }
}
