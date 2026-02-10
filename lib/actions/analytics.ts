"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import {
  decryptToken,
  refreshAccessToken,
  encryptToken,
  getGA4Totals,
  getGA4Data,
  getGA4Events,
  getGA4TopPages,
  getGA4TrafficSources,
} from "@/lib/google";

// ─── Types ────────────────────────────────────────────────────────────

export type GA4Overview = {
  sessions: number;
  totalUsers: number;
  pageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
};

export type GA4DailyRow = {
  date: string; // YYYYMMDD
  sessions: number;
  users: number;
  pageViews: number;
};

export type GA4EventRow = {
  eventName: string;
  eventCount: number;
  users: number;
};

export type GA4PageRow = {
  pagePath: string;
  pageViews: number;
  users: number;
};

export type GA4SourceRow = {
  channel: string;
  sessions: number;
  users: number;
};

export type GA4AnalyticsData = {
  overview: GA4Overview;
  daily: GA4DailyRow[];
  events: GA4EventRow[];
  topPages: GA4PageRow[];
  trafficSources: GA4SourceRow[];
  propertyName: string;
  fetchedAt: string;
};

export type AnalyticsResult = {
  success: boolean;
  error?: string;
  data?: GA4AnalyticsData;
  cached?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────

/** Parse GA4 API response rows into typed arrays */
function parseOverview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): GA4Overview {
  const row = data?.rows?.[0];
  if (!row) {
    return { sessions: 0, totalUsers: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0 };
  }
  const vals = row.metricValues || [];
  return {
    sessions: parseInt(vals[0]?.value || "0", 10),
    totalUsers: parseInt(vals[1]?.value || "0", 10),
    pageViews: parseInt(vals[2]?.value || "0", 10),
    bounceRate: parseFloat(vals[3]?.value || "0"),
    avgSessionDuration: parseFloat(vals[4]?.value || "0"),
  };
}

function parseDailyRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): GA4DailyRow[] {
  if (!data?.rows) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.rows.map((row: any) => ({
    date: row.dimensionValues?.[0]?.value || "",
    sessions: parseInt(row.metricValues?.[0]?.value || "0", 10),
    users: parseInt(row.metricValues?.[1]?.value || "0", 10),
    pageViews: parseInt(row.metricValues?.[2]?.value || "0", 10),
  }));
}

function parseEventRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): GA4EventRow[] {
  if (!data?.rows) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.rows.map((row: any) => ({
    eventName: row.dimensionValues?.[0]?.value || "",
    eventCount: parseInt(row.metricValues?.[0]?.value || "0", 10),
    users: parseInt(row.metricValues?.[1]?.value || "0", 10),
  }));
}

function parsePageRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): GA4PageRow[] {
  if (!data?.rows) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.rows.map((row: any) => ({
    pagePath: row.dimensionValues?.[0]?.value || "",
    pageViews: parseInt(row.metricValues?.[0]?.value || "0", 10),
    users: parseInt(row.metricValues?.[1]?.value || "0", 10),
  }));
}

function parseSourceRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): GA4SourceRow[] {
  if (!data?.rows) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.rows.map((row: any) => ({
    channel: row.dimensionValues?.[0]?.value || "",
    sessions: parseInt(row.metricValues?.[0]?.value || "0", 10),
    users: parseInt(row.metricValues?.[1]?.value || "0", 10),
  }));
}

// ─── Token refresh helper ─────────────────────────────────────────────

async function getValidAccessToken(integration: {
  id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}): Promise<string | null> {
  if (!integration.access_token_encrypted) return null;

  const accessToken = decryptToken(integration.access_token_encrypted);

  // Check if token is expired or will expire in the next 5 minutes
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes && integration.refresh_token_encrypted) {
      // Token expired or about to — refresh it
      try {
        const refreshToken = decryptToken(integration.refresh_token_encrypted);
        const newTokens = await refreshAccessToken(refreshToken);

        // Save refreshed token to DB using admin client
        const adminSupabase = createAdminClient();
        await adminSupabase
          .from("integrations")
          .update({
            access_token_encrypted: encryptToken(newTokens.access_token),
            token_expires_at: new Date(newTokens.expiry_date).toISOString(),
          })
          .eq("id", integration.id);

        return newTokens.access_token;
      } catch (err) {
        console.error("Failed to refresh GA4 token:", err);
        return accessToken; // Try with existing token anyway
      }
    }
  }

  return accessToken;
}

// ─── Cache helpers ────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Get date strings for cache period (YYYY-MM-DD) */
function getCachePeriodDates(period: string): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0]!;
  const daysBack = period === "7d" ? 7 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;
  return { periodStart: startDate, periodEnd: endDate };
}

async function getCachedAnalytics(
  clientId: string,
  period: string
): Promise<GA4AnalyticsData | null> {
  const supabase = await createClient();
  const { periodStart, periodEnd } = getCachePeriodDates(period);

  const { data } = await supabase
    .from("analytics_cache")
    .select("data, fetched_at")
    .eq("client_id", clientId)
    .eq("integration_type", "ga4")
    .eq("metric_type", `ga4_full_${period}`)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .single();

  if (!data) return null;

  // Check if cache is still fresh
  const fetchedAt = new Date(data.fetched_at).getTime();
  if (Date.now() - fetchedAt > CACHE_TTL_MS) return null;

  return data.data as unknown as GA4AnalyticsData;
}

async function setCachedAnalytics(
  clientId: string,
  period: string,
  analyticsData: GA4AnalyticsData
): Promise<void> {
  const adminSupabase = createAdminClient();
  const { periodStart, periodEnd } = getCachePeriodDates(period);
  const now = new Date().toISOString();

  // Upsert cache entry (unique on: client_id, integration_type, metric_type, period_start, period_end)
  await adminSupabase
    .from("analytics_cache")
    .upsert(
      {
        client_id: clientId,
        integration_type: "ga4" as const,
        metric_type: `ga4_full_${period}`,
        period_start: periodStart,
        period_end: periodEnd,
        data: analyticsData as unknown as Record<string, unknown>,
        fetched_at: now,
      },
      {
        onConflict: "client_id,integration_type,metric_type,period_start,period_end",
      }
    )
    .then(({ error }) => {
      if (error) console.error("Failed to cache analytics:", error);
    });
}

// ─── Main action ──────────────────────────────────────────────────────

/**
 * Fetch GA4 analytics for the current user's client (or selected client for admin).
 * Returns cached data if available and fresh, otherwise fetches from GA4 API.
 */
export async function fetchGA4Analytics(
  clientId?: string,
  period: "7d" | "30d" = "30d",
  forceRefresh = false
): Promise<AnalyticsResult> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const isAdmin = profile.role === "admin";

  // Determine which client to show data for
  let targetClientId = clientId;
  if (!targetClientId && isAdmin) {
    targetClientId = await getImpersonatedClientId() || undefined;
  }
  if (!targetClientId && !isAdmin) {
    // Non-admin: get their client
    const supabase = await createClient();
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", profile.id)
      .limit(1);
    targetClientId = clientUsers?.[0]?.client_id;
  }

  if (!targetClientId) {
    return { success: false, error: "No client selected. Choose a client to view analytics." };
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedAnalytics(targetClientId, period);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }

  // Find active GA4 integration for this client
  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, account_id, account_name, access_token_encrypted, refresh_token_encrypted, token_expires_at, metadata")
    .eq("client_id", targetClientId)
    .eq("type", "ga4")
    .eq("is_active", true)
    .single();

  if (!integration) {
    return { success: false, error: "No GA4 integration found. Connect GA4 in the client settings first." };
  }

  // Check if property is selected
  const metadata = (integration.metadata || {}) as Record<string, unknown>;
  if (metadata.needsPropertySelection) {
    return { success: false, error: "GA4 property not selected. Go to client settings and select a GA4 property." };
  }

  const propertyId = integration.account_id;
  if (!propertyId) {
    return { success: false, error: "GA4 property ID missing. Reconnect GA4 in client settings." };
  }

  // Get valid access token (with auto-refresh)
  const accessToken = await getValidAccessToken(integration);
  if (!accessToken) {
    return { success: false, error: "GA4 access token invalid. Reconnect GA4 in client settings." };
  }

  // Fetch all GA4 data in parallel
  const startDate = period === "7d" ? "7daysAgo" : "30daysAgo";
  const endDate = "today";

  try {
    const [totalsData, dailyData, eventsData, pagesData, sourcesData] = await Promise.all([
      getGA4Totals(accessToken, propertyId, startDate, endDate),
      getGA4Data(accessToken, propertyId, startDate, endDate),
      getGA4Events(accessToken, propertyId, startDate, endDate),
      getGA4TopPages(accessToken, propertyId, startDate, endDate),
      getGA4TrafficSources(accessToken, propertyId, startDate, endDate),
    ]);

    const analyticsData: GA4AnalyticsData = {
      overview: parseOverview(totalsData),
      daily: parseDailyRows(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
      events: parseEventRows(eventsData),
      topPages: parsePageRows(pagesData),
      trafficSources: parseSourceRows(sourcesData),
      propertyName: integration.account_name || propertyId,
      fetchedAt: new Date().toISOString(),
    };

    // Cache for next time (non-blocking)
    setCachedAnalytics(targetClientId, period, analyticsData).catch(() => {});

    return { success: true, data: analyticsData };
  } catch (err) {
    console.error("GA4 API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    // If it's a permission error, give specific guidance
    if (message.includes("403") || message.includes("Permission")) {
      return { success: false, error: "GA4 access denied. The connected Google account may not have access to this property." };
    }
    if (message.includes("401") || message.includes("invalid_grant")) {
      return { success: false, error: "GA4 authentication expired. Reconnect GA4 in client settings." };
    }

    return { success: false, error: `Failed to fetch GA4 data: ${message}` };
  }
}

/**
 * Get list of clients with GA4 integrations (for admin client selector).
 */
export async function getClientsWithGA4(): Promise<
  Array<{ clientId: string; clientName: string; propertyName: string | null }>
> {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("integrations")
    .select(`
      client_id,
      account_name,
      client:clients!client_id(business_name)
    `)
    .eq("type", "ga4")
    .eq("is_active", true);

  if (!data) return [];

  type IntegrationWithClient = {
    client_id: string;
    account_name: string | null;
    client: { business_name: string } | null;
  };

  return (data as IntegrationWithClient[])
    .filter((d) => d.client)
    .map((d) => ({
      clientId: d.client_id,
      clientName: d.client!.business_name,
      propertyName: d.account_name,
    }));
}
