"use server";

import { getProfile } from "@/lib/actions/profile";
import {
    decryptToken,
    refreshAccessToken,
    encryptToken,
    getGA4Totals,
    getGA4Data,
    getGA4Events,
    getGA4TopPages,
    getGA4TrafficSources,
    getGBPPerformanceMetrics,
    getGBPSearchKeywords,
    getGSCSearchAnalytics,
    getGSCTopQueries,
    getGSCTopPages as getGSCTopPagesAPI,
    getGSCDeviceBreakdown,
    type GA4ReportResponse,
    type GA4Row,
    type GSCQueryResponse,
    type GSCRow,
    type GBPMetricsResponse,
    type GBPKeywordsResponse,
} from "@/lib/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/view-context";

// ─── Types ────────────────────────────────────────────────────────────

export type ClientWebsite = { id: string; name: string };

/**
 * Tous les sites du client actif (indépendamment des intégrations) — source du
 * sélecteur de site global. RLS + impersonation gérées par `getActiveClientId`.
 */
export async function getClientWebsites(): Promise<ClientWebsite[]> {
    const clientId = await getActiveClientId();
    if (!clientId) return [];

    const supabase = await createClient();
    const { data } = await supabase
        .from("websites")
        .select("id, name")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

    return (data ?? []).map((w) => ({ id: w.id, name: w.name }));
}

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
function parseOverview(data: GA4ReportResponse): GA4Overview {
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

function parseDailyRows(data: GA4ReportResponse): GA4DailyRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GA4Row) => ({
        date: row.dimensionValues?.[0]?.value || "",
        sessions: parseInt(row.metricValues?.[0]?.value || "0", 10),
        users: parseInt(row.metricValues?.[1]?.value || "0", 10),
        pageViews: parseInt(row.metricValues?.[2]?.value || "0", 10),
    }));
}

function parseEventRows(data: GA4ReportResponse): GA4EventRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GA4Row) => ({
        eventName: row.dimensionValues?.[0]?.value || "",
        eventCount: parseInt(row.metricValues?.[0]?.value || "0", 10),
        users: parseInt(row.metricValues?.[1]?.value || "0", 10),
    }));
}

function parsePageRows(data: GA4ReportResponse): GA4PageRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GA4Row) => ({
        pagePath: row.dimensionValues?.[0]?.value || "",
        pageViews: parseInt(row.metricValues?.[0]?.value || "0", 10),
        users: parseInt(row.metricValues?.[1]?.value || "0", 10),
    }));
}

function parseSourceRows(data: GA4ReportResponse): GA4SourceRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GA4Row) => ({
        channel: row.dimensionValues?.[0]?.value || "",
        sessions: parseInt(row.metricValues?.[0]?.value || "0", 10),
        users: parseInt(row.metricValues?.[1]?.value || "0", 10),
    }));
}

// ─── Token refresh helper ─────────────────────────────────────────────

/** Resolved connected_account credential for a website's service integration. */
type ConnectedAccount = {
    id: string;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
};

/**
 * Valid Google access token for a connected_account — refreshes and persists
 * back to `connected_accounts` if it is expired or within 5 min of expiry.
 */
async function getValidAccessToken(account: ConnectedAccount): Promise<string | null> {
    if (!account.access_token_encrypted) return null;

    const accessToken = decryptToken(account.access_token_encrypted);

    if (account.token_expires_at) {
        const expiresAt = new Date(account.token_expires_at).getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (expiresAt - Date.now() < fiveMinutes && account.refresh_token_encrypted) {
            try {
                const refreshToken = decryptToken(account.refresh_token_encrypted);
                const newTokens = await refreshAccessToken(refreshToken);

                const adminSupabase = createAdminClient();
                await adminSupabase
                    .from("connected_accounts")
                    .update({
                        access_token_encrypted: encryptToken(newTokens.access_token),
                        token_expires_at: new Date(newTokens.expiry_date).toISOString(),
                    })
                    .eq("id", account.id);

                return newTokens.access_token;
            } catch (err) {
                console.error("Failed to refresh Google token:", err);
                return accessToken; // Try with existing token anyway
            }
        }
    }

    return accessToken;
}

/** Resolve a website's active integration for a service + its credential & resource. */
type ResolvedIntegration = {
    resourceId: string;
    resourceLabel: string | null;
    account: ConnectedAccount;
};

async function resolveIntegration(
    websiteId: string,
    service: "ga4" | "gbp" | "gsc",
): Promise<ResolvedIntegration | null> {
    // 1) L'intégration est lue en RLS : elle autorise l'accès au site (admin ou
    //    client propriétaire). On ne joint PAS le credential ici car un compte
    //    global (client_id null) est invisible en RLS au client.
    const supabase = await createClient();
    const { data } = await supabase
        .from("integrations")
        .select("resource_id, resource_label, account_id")
        .eq("website_id", websiteId)
        .eq("service", service)
        .eq("is_active", true)
        .maybeSingle();

    const row = data as {
        resource_id: string;
        resource_label: string | null;
        account_id: string;
    } | null;
    if (!row) return null;

    // 2) Tokens lus via service_role (jamais exposés côté RLS), après l'autorisation ci-dessus.
    const admin = createAdminClient();
    const { data: account } = await admin
        .from("connected_accounts")
        .select("id, access_token_encrypted, refresh_token_encrypted, token_expires_at")
        .eq("id", row.account_id)
        .maybeSingle();
    if (!account) return null;

    return {
        resourceId: row.resource_id,
        resourceLabel: row.resource_label,
        account: account as unknown as ConnectedAccount,
    };
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
    websiteId: string,
    period: string,
): Promise<GA4AnalyticsData | null> {
    const supabase = await createClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);

    const { data } = await supabase
        .from("analytics_cache")
        .select("data, fetched_at")
        .eq("website_id", websiteId)
        .eq("service", "ga4")
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
    websiteId: string,
    period: string,
    analyticsData: GA4AnalyticsData,
): Promise<void> {
    const adminSupabase = createAdminClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);
    const now = new Date().toISOString();

    // Upsert cache entry (unique on: website_id, service, metric_type, period_start, period_end)
    await adminSupabase
        .from("analytics_cache")
        .upsert(
            {
                website_id: websiteId,
                service: "ga4" as const,
                metric_type: `ga4_full_${period}`,
                period_start: periodStart,
                period_end: periodEnd,
                data: analyticsData as unknown as Record<string, unknown>,
                fetched_at: now,
            },
            {
                onConflict: "website_id,service,metric_type,period_start,period_end",
            },
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
    websiteId: string,
    period: "7d" | "30d" = "30d",
    forceRefresh = false,
): Promise<AnalyticsResult> {
    const profile = await getProfile();
    if (!profile) return { success: false, error: "Not authenticated" };
    if (!websiteId) {
        return {
            success: false,
            error: "No website selected. Choose a website to view analytics.",
        };
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
        const cached = await getCachedAnalytics(websiteId, period);
        if (cached) {
            return { success: true, data: cached, cached: true };
        }
    }

    // Resolve the website's GA4 binding (RLS scopes access to the caller's websites).
    const resolved = await resolveIntegration(websiteId, "ga4");
    if (!resolved) {
        return {
            success: false,
            error: "No GA4 integration found. Connect GA4 and bind a property to this website.",
        };
    }

    const propertyId = resolved.resourceId;

    // Get valid access token (with auto-refresh)
    const accessToken = await getValidAccessToken(resolved.account);
    if (!accessToken) {
        return {
            success: false,
            error: "GA4 access token invalid. Reconnect the Google account in client settings.",
        };
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
            propertyName: resolved.resourceLabel || propertyId,
            fetchedAt: new Date().toISOString(),
        };

        // Cache for next time (non-blocking)
        setCachedAnalytics(websiteId, period, analyticsData).catch(() => {});

        return { success: true, data: analyticsData };
    } catch (err) {
        console.error("GA4 API error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";

        // If it's a permission error, give specific guidance
        if (message.includes("403") || message.includes("Permission")) {
            return {
                success: false,
                error: "GA4 access denied. The connected Google account may not have access to this property.",
            };
        }
        if (message.includes("401") || message.includes("invalid_grant")) {
            return {
                success: false,
                error: "GA4 authentication expired. Reconnect GA4 in client settings.",
            };
        }

        return { success: false, error: `Failed to fetch GA4 data: ${message}` };
    }
}

/** A website bound to a given analytics service (for the analytics page selector). */
export type WebsiteWithIntegration = {
    websiteId: string;
    websiteName: string;
    clientName: string;
    resourceLabel: string | null;
};

/** Rows from an integrations→website→client join, used by the selectors below. */
type IntegrationWebsiteRow = {
    resource_label: string | null;
    website: { id: string; name: string; client: { business_name: string } | null } | null;
};

function mapWebsitesWithIntegration(rows: IntegrationWebsiteRow[]): WebsiteWithIntegration[] {
    return rows
        .filter((r) => r.website)
        .map((r) => ({
            websiteId: r.website!.id,
            websiteName: r.website!.name,
            clientName: r.website!.client?.business_name ?? "",
            resourceLabel: r.resource_label,
        }));
}

const INTEGRATION_WEBSITE_SELECT = `
    resource_label,
    website:websites!website_id(id, name, client:clients!client_id(business_name))
`;

/** Websites with an active GA4 binding the current user can access (RLS-scoped). */
export async function getWebsitesWithGA4(): Promise<WebsiteWithIntegration[]> {
    const profile = await getProfile();
    if (!profile) return [];

    const supabase = await createClient();
    const { data } = await supabase
        .from("integrations")
        .select(INTEGRATION_WEBSITE_SELECT)
        .eq("service", "ga4")
        .eq("is_active", true);

    return mapWebsitesWithIntegration((data as unknown as IntegrationWebsiteRow[]) ?? []);
}

/**
 * Fusionne les métriques GA4 de plusieurs sites en un seul jeu agrégé.
 * Sommes pour les compteurs ; moyennes (taux de rebond, durée) **pondérées par
 * les sessions** pour rester correctes. `propertyName` vidé → l'UI affiche un
 * libellé « Tous les sites ».
 */
function mergeGA4(datas: GA4AnalyticsData[]): GA4AnalyticsData {
    const overview: GA4Overview = {
        sessions: 0,
        totalUsers: 0,
        pageViews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
    };
    let weightedBounce = 0;
    let weightedDuration = 0;
    const daily = new Map<string, GA4DailyRow>();
    const events = new Map<string, GA4EventRow>();
    const pages = new Map<string, GA4PageRow>();
    const sources = new Map<string, GA4SourceRow>();

    for (const d of datas) {
        overview.sessions += d.overview.sessions;
        overview.totalUsers += d.overview.totalUsers;
        overview.pageViews += d.overview.pageViews;
        weightedBounce += d.overview.bounceRate * d.overview.sessions;
        weightedDuration += d.overview.avgSessionDuration * d.overview.sessions;

        for (const r of d.daily) {
            const e = daily.get(r.date) ?? { date: r.date, sessions: 0, users: 0, pageViews: 0 };
            e.sessions += r.sessions;
            e.users += r.users;
            e.pageViews += r.pageViews;
            daily.set(r.date, e);
        }
        for (const r of d.events) {
            const e = events.get(r.eventName) ?? {
                eventName: r.eventName,
                eventCount: 0,
                users: 0,
            };
            e.eventCount += r.eventCount;
            e.users += r.users;
            events.set(r.eventName, e);
        }
        for (const r of d.topPages) {
            const e = pages.get(r.pagePath) ?? { pagePath: r.pagePath, pageViews: 0, users: 0 };
            e.pageViews += r.pageViews;
            e.users += r.users;
            pages.set(r.pagePath, e);
        }
        for (const r of d.trafficSources) {
            const e = sources.get(r.channel) ?? { channel: r.channel, sessions: 0, users: 0 };
            e.sessions += r.sessions;
            e.users += r.users;
            sources.set(r.channel, e);
        }
    }

    if (overview.sessions > 0) {
        overview.bounceRate = weightedBounce / overview.sessions;
        overview.avgSessionDuration = weightedDuration / overview.sessions;
    }

    return {
        overview,
        daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
        events: [...events.values()].sort((a, b) => b.eventCount - a.eventCount),
        topPages: [...pages.values()].sort((a, b) => b.pageViews - a.pageViews).slice(0, 10),
        trafficSources: [...sources.values()].sort((a, b) => b.sessions - a.sessions),
        propertyName: "",
        fetchedAt: new Date().toISOString(),
    };
}

/** Agrège GA4 sur tous les sites du client (option « Tous les sites »). */
export async function fetchGA4AnalyticsAggregate(
    period: "7d" | "30d" = "30d",
    forceRefresh = false,
): Promise<AnalyticsResult> {
    const websites = await getWebsitesWithGA4();
    if (websites.length === 0) {
        return { success: false, error: "No GA4 integration found." };
    }

    const results = await Promise.all(
        websites.map((w) => fetchGA4Analytics(w.websiteId, period, forceRefresh)),
    );
    const datas = results.filter((r) => r.success && r.data).map((r) => r.data!);
    if (datas.length === 0) {
        return { success: false, error: results.find((r) => r.error)?.error || "No GA4 data." };
    }

    return { success: true, data: mergeGA4(datas), cached: results.every((r) => r.cached) };
}

// ─── GBP Types ────────────────────────────────────────────────────────

export type GBPMetricTotals = {
    directionRequests: number;
    callClicks: number;
    websiteClicks: number;
    impressionsMaps: number;
    impressionsSearch: number;
    totalImpressions: number;
    totalInteractions: number;
};

export type GBPDailyMetric = {
    date: string; // YYYY-MM-DD
    directionRequests: number;
    callClicks: number;
    websiteClicks: number;
};

export type GBPSearchKeyword = {
    keyword: string;
    impressions: number;
};

export type GBPAnalyticsData = {
    totals: GBPMetricTotals;
    daily: GBPDailyMetric[];
    searchKeywords: GBPSearchKeyword[];
    locationName: string;
    fetchedAt: string;
};

export type GBPAnalyticsResult = {
    success: boolean;
    error?: string;
    data?: GBPAnalyticsData;
    cached?: boolean;
};

// ─── GBP Helpers ──────────────────────────────────────────────────────

/** Parse GBP fetchMultiDailyMetricsTimeSeries response */
function parseGBPMetrics(data: GBPMetricsResponse): {
    totals: GBPMetricTotals;
    daily: GBPDailyMetric[];
} {
    const metricMap: Record<string, Record<string, number>> = {};
    const totalsMap: Record<string, number> = {};

    const series = data?.multiDailyMetricTimeSeries || [];
    for (const multi of series) {
        const dailySeries = multi.dailyMetricTimeSeries || [];
        for (const ts of dailySeries) {
            const metricName = ts.dailyMetric || "";
            let metricTotal = 0;
            const datedValues = ts.timeSeries?.datedValues || [];
            for (const dv of datedValues) {
                const val = parseInt(dv.value || "0", 10);
                metricTotal += val;
                if (dv.date) {
                    const dateKey = `${dv.date.year}-${String(dv.date.month).padStart(2, "0")}-${String(dv.date.day).padStart(2, "0")}`;
                    if (!metricMap[dateKey]) metricMap[dateKey] = {};
                    metricMap[dateKey]![metricName] = (metricMap[dateKey]![metricName] || 0) + val;
                }
            }
            totalsMap[metricName] = (totalsMap[metricName] || 0) + metricTotal;
        }
    }

    const impressionsMaps =
        (totalsMap["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"] || 0) +
        (totalsMap["BUSINESS_IMPRESSIONS_MOBILE_MAPS"] || 0);
    const impressionsSearch =
        (totalsMap["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"] || 0) +
        (totalsMap["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"] || 0);

    const totals: GBPMetricTotals = {
        directionRequests: totalsMap["BUSINESS_DIRECTION_REQUESTS"] || 0,
        callClicks: totalsMap["CALL_CLICKS"] || 0,
        websiteClicks: totalsMap["WEBSITE_CLICKS"] || 0,
        impressionsMaps,
        impressionsSearch,
        totalImpressions: impressionsMaps + impressionsSearch,
        totalInteractions:
            (totalsMap["BUSINESS_DIRECTION_REQUESTS"] || 0) +
            (totalsMap["CALL_CLICKS"] || 0) +
            (totalsMap["WEBSITE_CLICKS"] || 0),
    };

    const daily: GBPDailyMetric[] = Object.entries(metricMap)
        .map(([date, metrics]) => ({
            date,
            directionRequests: metrics["BUSINESS_DIRECTION_REQUESTS"] || 0,
            callClicks: metrics["CALL_CLICKS"] || 0,
            websiteClicks: metrics["WEBSITE_CLICKS"] || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return { totals, daily };
}

/** Parse GBP search keywords response */
function parseGBPKeywords(data: GBPKeywordsResponse): GBPSearchKeyword[] {
    const results = data?.searchKeywordsCounts || [];
    return results.map((item) => ({
        keyword: item.searchKeyword || "",
        impressions: parseInt(item.insightsValue?.value || "0", 10),
    }));
}

// ─── GBP Cache helpers ───────────────────────────────────────────────

async function getCachedGBPAnalytics(
    websiteId: string,
    period: string,
): Promise<GBPAnalyticsData | null> {
    const supabase = await createClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);

    const { data } = await supabase
        .from("analytics_cache")
        .select("data, fetched_at")
        .eq("website_id", websiteId)
        .eq("service", "gbp")
        .eq("metric_type", `gbp_full_${period}`)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .single();

    if (!data) return null;

    const fetchedAt = new Date(data.fetched_at).getTime();
    if (Date.now() - fetchedAt > CACHE_TTL_MS) return null;

    return data.data as unknown as GBPAnalyticsData;
}

async function setCachedGBPAnalytics(
    websiteId: string,
    period: string,
    analyticsData: GBPAnalyticsData,
): Promise<void> {
    const adminSupabase = createAdminClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);
    const now = new Date().toISOString();

    await adminSupabase
        .from("analytics_cache")
        .upsert(
            {
                website_id: websiteId,
                service: "gbp" as const,
                metric_type: `gbp_full_${period}`,
                period_start: periodStart,
                period_end: periodEnd,
                data: analyticsData as unknown as Record<string, unknown>,
                fetched_at: now,
            },
            {
                onConflict: "website_id,service,metric_type,period_start,period_end",
            },
        )
        .then(({ error }) => {
            if (error) console.error("Failed to cache GBP analytics:", error);
        });
}

// ─── GBP Main action ─────────────────────────────────────────────────

export async function fetchGBPAnalytics(
    websiteId: string,
    period: "7d" | "30d" = "30d",
    forceRefresh = false,
): Promise<GBPAnalyticsResult> {
    const profile = await getProfile();
    if (!profile) return { success: false, error: "Not authenticated" };
    if (!websiteId) return { success: false, error: "No website selected." };

    // Check cache
    if (!forceRefresh) {
        const cached = await getCachedGBPAnalytics(websiteId, period);
        if (cached) {
            return { success: true, data: cached, cached: true };
        }
    }

    // Resolve the website's GBP binding (RLS-scoped to the caller's websites).
    const resolved = await resolveIntegration(websiteId, "gbp");
    if (!resolved) {
        return {
            success: false,
            error: "No GBP integration found. Connect Google Business Profile and bind a location to this website.",
        };
    }

    const locationId = resolved.resourceId;

    const accessToken = await getValidAccessToken(resolved.account);
    if (!accessToken) {
        return {
            success: false,
            error: "GBP access token invalid. Reconnect the Google account in client settings.",
        };
    }

    // Build date range (GBP data has 2-3 day delay, so end 3 days ago)
    const now = new Date();
    const endDateObj = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const daysBack = period === "7d" ? 7 : 30;
    const startDateObj = new Date(endDateObj.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const startDate = {
        year: startDateObj.getFullYear(),
        month: startDateObj.getMonth() + 1,
        day: startDateObj.getDate(),
    };
    const endDate = {
        year: endDateObj.getFullYear(),
        month: endDateObj.getMonth() + 1,
        day: endDateObj.getDate(),
    };

    // Search keywords: current month and previous month
    const currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const prevMonth =
        now.getMonth() === 0
            ? { year: now.getFullYear() - 1, month: 12 }
            : { year: now.getFullYear(), month: now.getMonth() };

    try {
        const [metricsData, keywordsData] = await Promise.all([
            getGBPPerformanceMetrics(accessToken, locationId, startDate, endDate),
            getGBPSearchKeywords(accessToken, locationId, prevMonth, currentMonth).catch(
                () => null,
            ),
        ]);

        const { totals, daily } = parseGBPMetrics(metricsData);
        const searchKeywords = keywordsData ? parseGBPKeywords(keywordsData) : [];

        const analyticsData: GBPAnalyticsData = {
            totals,
            daily,
            searchKeywords,
            locationName: resolved.resourceLabel || locationId,
            fetchedAt: new Date().toISOString(),
        };

        setCachedGBPAnalytics(websiteId, period, analyticsData).catch(() => {});

        return { success: true, data: analyticsData };
    } catch (err) {
        console.error("GBP API error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";

        if (message.includes("403") || message.includes("Permission")) {
            return {
                success: false,
                error: "GBP access denied. Make sure the Business Profile Performance API is enabled in Google Cloud Console.",
            };
        }
        if (message.includes("401") || message.includes("invalid_grant")) {
            return {
                success: false,
                error: "GBP authentication expired. Reconnect GBP in client settings.",
            };
        }

        return { success: false, error: `Failed to fetch GBP data: ${message}` };
    }
}

/** Websites with an active GBP binding the current user can access (RLS-scoped). */
export async function getWebsitesWithGBP(): Promise<WebsiteWithIntegration[]> {
    const profile = await getProfile();
    if (!profile) return [];

    const supabase = await createClient();
    const { data } = await supabase
        .from("integrations")
        .select(INTEGRATION_WEBSITE_SELECT)
        .eq("service", "gbp")
        .eq("is_active", true);

    return mapWebsitesWithIntegration((data as unknown as IntegrationWebsiteRow[]) ?? []);
}

// ─── GSC Types ────────────────────────────────────────────────────────

export type GSCOverview = {
    totalClicks: number;
    totalImpressions: number;
    averageCTR: number;
    averagePosition: number;
};

export type GSCDailyRow = {
    date: string; // YYYY-MM-DD
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

export type GSCQueryRow = {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

export type GSCPageRow = {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

export type GSCDeviceRow = {
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

export type GSCAnalyticsData = {
    overview: GSCOverview;
    daily: GSCDailyRow[];
    topQueries: GSCQueryRow[];
    topPages: GSCPageRow[];
    deviceBreakdown: GSCDeviceRow[];
    siteUrl: string;
    fetchedAt: string;
};

export type GSCAnalyticsResult = {
    success: boolean;
    error?: string;
    data?: GSCAnalyticsData;
    cached?: boolean;
};

// ─── GSC Helpers ──────────────────────────────────────────────────────

function parseGSCDailyRows(data: GSCQueryResponse): GSCDailyRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GSCRow) => ({
        date: row.keys?.[0] || "",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
    }));
}

function parseGSCQueryRows(data: GSCQueryResponse): GSCQueryRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GSCRow) => ({
        query: row.keys?.[0] || "",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
    }));
}

function parseGSCPageRows(data: GSCQueryResponse): GSCPageRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GSCRow) => ({
        page: row.keys?.[0] || "",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
    }));
}

function parseGSCDeviceRows(data: GSCQueryResponse): GSCDeviceRow[] {
    if (!data?.rows) return [];
    return data.rows.map((row: GSCRow) => ({
        device: row.keys?.[0] || "",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
    }));
}

// ─── GSC Cache helpers ───────────────────────────────────────────────

async function getCachedGSCAnalytics(
    websiteId: string,
    period: string,
): Promise<GSCAnalyticsData | null> {
    const supabase = await createClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);

    const { data } = await supabase
        .from("analytics_cache")
        .select("data, fetched_at")
        .eq("website_id", websiteId)
        .eq("service", "gsc")
        .eq("metric_type", `gsc_full_${period}`)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .single();

    if (!data) return null;

    const fetchedAt = new Date(data.fetched_at).getTime();
    if (Date.now() - fetchedAt > CACHE_TTL_MS) return null;

    return data.data as unknown as GSCAnalyticsData;
}

async function setCachedGSCAnalytics(
    websiteId: string,
    period: string,
    analyticsData: GSCAnalyticsData,
): Promise<void> {
    const adminSupabase = createAdminClient();
    const { periodStart, periodEnd } = getCachePeriodDates(period);
    const now = new Date().toISOString();

    await adminSupabase
        .from("analytics_cache")
        .upsert(
            {
                website_id: websiteId,
                service: "gsc" as const,
                metric_type: `gsc_full_${period}`,
                period_start: periodStart,
                period_end: periodEnd,
                data: analyticsData as unknown as Record<string, unknown>,
                fetched_at: now,
            },
            {
                onConflict: "website_id,service,metric_type,period_start,period_end",
            },
        )
        .then(({ error }) => {
            if (error) console.error("Failed to cache GSC analytics:", error);
        });
}

// ─── GSC Main action ─────────────────────────────────────────────────

export async function fetchGSCAnalytics(
    websiteId: string,
    period: "7d" | "30d" = "30d",
    forceRefresh = false,
): Promise<GSCAnalyticsResult> {
    const profile = await getProfile();
    if (!profile) return { success: false, error: "Not authenticated" };
    if (!websiteId) return { success: false, error: "No website selected." };

    // Check cache
    if (!forceRefresh) {
        const cached = await getCachedGSCAnalytics(websiteId, period);
        if (cached) {
            return { success: true, data: cached, cached: true };
        }
    }

    // Resolve the website's GSC binding (RLS-scoped to the caller's websites).
    const resolved = await resolveIntegration(websiteId, "gsc");
    if (!resolved) {
        return {
            success: false,
            error: "No Search Console integration found. Connect Google Search Console and bind a site to this website.",
        };
    }

    const siteUrl = resolved.resourceId;

    const accessToken = await getValidAccessToken(resolved.account);
    if (!accessToken) {
        return {
            success: false,
            error: "Search Console access token invalid. Reconnect the Google account in client settings.",
        };
    }

    // Build date range (GSC data has ~2 day delay)
    const now = new Date();
    const endDateObj = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const daysBack = period === "7d" ? 7 : 30;
    const startDateObj = new Date(endDateObj.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const startDate = startDateObj.toISOString().split("T")[0]!;
    const endDate = endDateObj.toISOString().split("T")[0]!;

    try {
        const [dailyData, queriesData, pagesData, deviceData] = await Promise.all([
            getGSCSearchAnalytics(accessToken, siteUrl, startDate, endDate),
            getGSCTopQueries(accessToken, siteUrl, startDate, endDate),
            getGSCTopPagesAPI(accessToken, siteUrl, startDate, endDate),
            getGSCDeviceBreakdown(accessToken, siteUrl, startDate, endDate),
        ]);

        const daily = parseGSCDailyRows(dailyData).sort((a, b) => a.date.localeCompare(b.date));
        const topQueries = parseGSCQueryRows(queriesData);
        const topPages = parseGSCPageRows(pagesData);
        const deviceBreakdown = parseGSCDeviceRows(deviceData);

        // Calculate overview totals from daily data
        const overview: GSCOverview = {
            totalClicks: daily.reduce((sum, d) => sum + d.clicks, 0),
            totalImpressions: daily.reduce((sum, d) => sum + d.impressions, 0),
            averageCTR:
                daily.length > 0 ? daily.reduce((sum, d) => sum + d.ctr, 0) / daily.length : 0,
            averagePosition:
                daily.length > 0 ? daily.reduce((sum, d) => sum + d.position, 0) / daily.length : 0,
        };

        const analyticsData: GSCAnalyticsData = {
            overview,
            daily,
            topQueries,
            topPages,
            deviceBreakdown,
            siteUrl: resolved.resourceLabel || siteUrl,
            fetchedAt: new Date().toISOString(),
        };

        setCachedGSCAnalytics(websiteId, period, analyticsData).catch(() => {});

        return { success: true, data: analyticsData };
    } catch (err) {
        console.error("GSC API error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";

        if (message.includes("403") || message.includes("Permission")) {
            return {
                success: false,
                error: "Search Console access denied. The connected Google account may not have access to this site.",
            };
        }
        if (message.includes("401") || message.includes("invalid_grant")) {
            return {
                success: false,
                error: "Search Console authentication expired. Reconnect GSC in client settings.",
            };
        }

        return { success: false, error: `Failed to fetch Search Console data: ${message}` };
    }
}

/** Websites with an active GSC binding the current user can access (RLS-scoped). */
export async function getWebsitesWithGSC(): Promise<WebsiteWithIntegration[]> {
    const profile = await getProfile();
    if (!profile) return [];

    const supabase = await createClient();
    const { data } = await supabase
        .from("integrations")
        .select(INTEGRATION_WEBSITE_SELECT)
        .eq("service", "gsc")
        .eq("is_active", true);

    return mapWebsitesWithIntegration((data as unknown as IntegrationWebsiteRow[]) ?? []);
}

/**
 * Fusionne les métriques GSC de plusieurs sites. Clics/impressions sommés ;
 * CTR recalculé (clics/impressions) et position **pondérée par les impressions**
 * (une moyenne simple des positions fausserait le résultat).
 */
function mergeGSC(datas: GSCAnalyticsData[]): GSCAnalyticsData {
    // Accumulateur : clics, impressions, et position×impressions (pour pondérer).
    type Acc = { clicks: number; impressions: number; weightedPos: number };
    const finalize = (a: Acc) => ({
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
        position: a.impressions > 0 ? a.weightedPos / a.impressions : 0,
    });
    const add = (m: Map<string, Acc>, key: string, clicks: number, imp: number, pos: number) => {
        const a = m.get(key) ?? { clicks: 0, impressions: 0, weightedPos: 0 };
        a.clicks += clicks;
        a.impressions += imp;
        a.weightedPos += pos * imp;
        m.set(key, a);
    };

    const overview = { clicks: 0, impressions: 0, weightedPos: 0 };
    const daily = new Map<string, Acc>();
    const queries = new Map<string, Acc>();
    const pages = new Map<string, Acc>();
    const devices = new Map<string, Acc>();

    for (const d of datas) {
        overview.clicks += d.overview.totalClicks;
        overview.impressions += d.overview.totalImpressions;
        overview.weightedPos += d.overview.averagePosition * d.overview.totalImpressions;
        for (const r of d.daily) add(daily, r.date, r.clicks, r.impressions, r.position);
        for (const r of d.topQueries) add(queries, r.query, r.clicks, r.impressions, r.position);
        for (const r of d.topPages) add(pages, r.page, r.clicks, r.impressions, r.position);
        for (const r of d.deviceBreakdown)
            add(devices, r.device, r.clicks, r.impressions, r.position);
    }

    const byClicks = (a: { clicks: number }, b: { clicks: number }) => b.clicks - a.clicks;

    return {
        overview: {
            totalClicks: overview.clicks,
            totalImpressions: overview.impressions,
            averageCTR: overview.impressions > 0 ? overview.clicks / overview.impressions : 0,
            averagePosition:
                overview.impressions > 0 ? overview.weightedPos / overview.impressions : 0,
        },
        daily: [...daily.entries()]
            .map(([date, a]) => ({ date, ...finalize(a) }))
            .sort((x, y) => x.date.localeCompare(y.date)),
        topQueries: [...queries.entries()]
            .map(([query, a]) => ({ query, ...finalize(a) }))
            .sort(byClicks)
            .slice(0, 10),
        topPages: [...pages.entries()]
            .map(([page, a]) => ({ page, ...finalize(a) }))
            .sort(byClicks)
            .slice(0, 10),
        deviceBreakdown: [...devices.entries()]
            .map(([device, a]) => ({ device, ...finalize(a) }))
            .sort(byClicks),
        siteUrl: "",
        fetchedAt: new Date().toISOString(),
    };
}

/** Agrège GSC sur tous les sites du client (option « Tous les sites »). */
export async function fetchGSCAnalyticsAggregate(
    period: "7d" | "30d" = "30d",
    forceRefresh = false,
): Promise<GSCAnalyticsResult> {
    const websites = await getWebsitesWithGSC();
    if (websites.length === 0) {
        return { success: false, error: "No Search Console integration found." };
    }

    const results = await Promise.all(
        websites.map((w) => fetchGSCAnalytics(w.websiteId, period, forceRefresh)),
    );
    const datas = results.filter((r) => r.success && r.data).map((r) => r.data!);
    if (datas.length === 0) {
        return { success: false, error: results.find((r) => r.error)?.error || "No GSC data." };
    }

    return { success: true, data: mergeGSC(datas), cached: results.every((r) => r.cached) };
}
