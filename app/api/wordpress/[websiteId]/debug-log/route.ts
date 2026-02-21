import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient } from "@/lib/wordpress/wp-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { websiteId } = await params;

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const data = await client.getDebugLog(500);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
