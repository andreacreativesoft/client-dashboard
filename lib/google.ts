import crypto from "crypto";

import { google } from "googleapis";
import type { analyticsdata_v1beta } from "googleapis";
import type { searchconsole_v1 } from "googleapis";
import type { businessprofileperformance_v1 } from "googleapis";

// ─── Google API response types (re-exported for consumers) ─────────
export type GA4ReportResponse = analyticsdata_v1beta.Schema$RunReportResponse;
export type GA4Row = analyticsdata_v1beta.Schema$Row;
export type GSCQueryResponse = searchconsole_v1.Schema$SearchAnalyticsQueryResponse;
export type GSCRow = searchconsole_v1.Schema$ApiDataRow;
export type GBPMetricsResponse =
    businessprofileperformance_v1.Schema$FetchMultiDailyMetricsTimeSeriesResponse;
export type GBPKeywordsResponse =
    businessprofileperformance_v1.Schema$ListSearchKeywordImpressionsMonthlyResponse;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

/**
 * Scopes de données requis pour lire GA4, Google Business Profile et Search
 * Console. C'est la source de vérité comparée aux scopes réellement accordés.
 */
export const REQUIRED_DATA_SCOPES = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/webmasters.readonly",
];

/**
 * APIs Google Cloud à activer sur le projet OAuth pour que les scopes ci-dessus
 * fonctionnent (rappelé au boot en cas de config incomplète).
 */
export const REQUIRED_GOOGLE_APIS = [
    "Google Analytics Data API (analyticsdata)",
    "Google Analytics Admin API (analyticsadmin)",
    "Business Profile APIs (mybusiness*, businessprofileperformance)",
    "Google Search Console API (searchconsole)",
];

// Scopes demandés au consentement : identité (pour distinguer les comptes) + données.
const SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    ...REQUIRED_DATA_SCOPES,
];

/**
 * Diagnostic de configuration OAuth (variables d'env). Utilisé au démarrage
 * pour logguer un warning si les connexions Google seraient indisponibles.
 */
export function getGoogleOAuthConfigStatus(): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!TOKEN_ENCRYPTION_KEY) missing.push("TOKEN_ENCRYPTION_KEY");
    if (!process.env.GOOGLE_REDIRECT_URI && !process.env.NEXT_PUBLIC_APP_URL) {
        missing.push("GOOGLE_REDIRECT_URI (ou NEXT_PUBLIC_APP_URL)");
    }
    return { ok: missing.length === 0, missing };
}

/**
 * Détermine les scopes de données manquants dans une liste accordée par Google.
 * Retourne [] si l'ensemble est suffisant.
 */
export function missingDataScopes(grantedScopes: string[]): string[] {
    const granted = new Set(grantedScopes);
    return REQUIRED_DATA_SCOPES.filter((s) => !granted.has(s));
}

/** Extrait l'email du compte Google depuis l'id_token OpenID (JWT non vérifié). */
export function decodeIdTokenEmail(idToken: string | null | undefined): string | null {
    if (!idToken) return null;
    try {
        const payload = idToken.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload, "base64").toString());
        return typeof json.email === "string" ? json.email : null;
    } catch {
        return null;
    }
}

export function getOAuth2Client() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error("Google OAuth not configured");
    }

    return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getAuthUrl(state: string): string {
    const oauth2Client = getOAuth2Client();

    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        state,
        prompt: "consent",
    });
}

export async function getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expiry_date: number;
    id_token: string | null;
    scope: string | null;
}> {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
        throw new Error("Invalid token response from Google");
    }

    return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        id_token: tokens.id_token ?? null,
        scope: tokens.scope ?? null,
    };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expiry_date: number;
}> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
        throw new Error("Failed to refresh access token");
    }

    return {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
    };
}

// AES-256 key derived once from TOKEN_ENCRYPTION_KEY (cached). The env value is
// the long-lived secret; we stretch it to a 32-byte key with a fixed app salt.
let cachedKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
    if (!TOKEN_ENCRYPTION_KEY) {
        throw new Error(
            "TOKEN_ENCRYPTION_KEY is not set. Refusing to handle tokens. " +
                "Set TOKEN_ENCRYPTION_KEY (min 32 bytes) in your environment variables.",
        );
    }
    if (!cachedKey) {
        cachedKey = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, "vsp-token-encryption", 32);
    }
    return cachedKey;
}

// Authenticated encryption (AES-256-GCM) for tokens at rest — confidential AND
// tamper-evident. Format: base64(iv):base64(authTag):base64(ciphertext).
export function encryptToken(token: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(encryptedToken: string): string {
    const key = getEncryptionKey();
    const [ivB64, tagB64, dataB64] = encryptedToken.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error("Malformed encrypted token.");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(dataB64, "base64")),
        decipher.final(),
    ]).toString("utf8");
}

// GA4 Data API — overview metrics by day
export async function getGA4Data(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
): Promise<GA4ReportResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({
        version: "v1beta",
        auth: oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: "sessions" },
                { name: "totalUsers" },
                { name: "screenPageViews" },
                { name: "bounceRate" },
                { name: "averageSessionDuration" },
            ],
            dimensions: [{ name: "date" }],
        },
    });

    return response.data;
}

// GA4 Data API — overview totals (no dimension breakdown)
export async function getGA4Totals(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
): Promise<GA4ReportResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({
        version: "v1beta",
        auth: oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: "sessions" },
                { name: "totalUsers" },
                { name: "screenPageViews" },
                { name: "bounceRate" },
                { name: "averageSessionDuration" },
            ],
        },
    });

    return response.data;
}

// GA4 Data API — custom events (CTA clicks, conversions, etc.)
export async function getGA4Events(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
): Promise<GA4ReportResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({
        version: "v1beta",
        auth: oauth2Client,
    });

    // Get all events grouped by event name
    const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
            dimensions: [{ name: "eventName" }],
            orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
            limit: "50",
        },
    });

    return response.data;
}

// GA4 Data API — top pages by views
export async function getGA4TopPages(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
): Promise<GA4ReportResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({
        version: "v1beta",
        auth: oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
            dimensions: [{ name: "pagePath" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: "10",
        },
    });

    return response.data;
}

// GA4 Data API — traffic sources
export async function getGA4TrafficSources(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
): Promise<GA4ReportResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({
        version: "v1beta",
        auth: oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: "10",
        },
    });

    return response.data;
}

// List GA4 properties for account selection
export async function listGA4Properties(accessToken: string) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const analyticsAdmin = google.analyticsadmin({
        version: "v1beta",
        auth: oauth2Client,
    });

    const response = await analyticsAdmin.accountSummaries.list();
    return response.data.accountSummaries || [];
}

// Google Business Profile API
export async function getGBPLocations(accessToken: string) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const mybusiness = google.mybusinessaccountmanagement({
        version: "v1",
        auth: oauth2Client,
    });

    const accountsResponse = await mybusiness.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    const locations: Array<{
        accountId: string;
        accountName: string;
        locationId: string;
        locationName: string;
    }> = [];

    for (const account of accounts) {
        if (!account.name) continue;

        const accountId = account.name.replace("accounts/", "");
        const businessInfo = google.mybusinessbusinessinformation({
            version: "v1",
            auth: oauth2Client,
        });

        try {
            const locationsResponse = await businessInfo.accounts.locations.list({
                parent: account.name,
                readMask: "name,title",
            });

            for (const location of locationsResponse.data.locations || []) {
                if (location.name && location.title) {
                    locations.push({
                        accountId,
                        accountName: account.accountName || accountId,
                        locationId: location.name.split("/").pop() || "",
                        locationName: location.title,
                    });
                }
            }
        } catch (err) {
            console.error(
                `Failed to list locations for account ${account.name}:`,
                err instanceof Error ? err.message : err,
            );
            continue;
        }
    }

    return locations;
}

// GBP Performance API — fetch daily metrics (direction requests, calls, website clicks, impressions)
export async function getGBPPerformanceMetrics(
    accessToken: string,
    locationId: string,
    startDate: { year: number; month: number; day: number },
    endDate: { year: number; month: number; day: number },
): Promise<GBPMetricsResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const businessPerformance = google.businessprofileperformance({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await businessPerformance.locations.fetchMultiDailyMetricsTimeSeries({
        location: `locations/${locationId}`,
        dailyMetrics: [
            "BUSINESS_DIRECTION_REQUESTS",
            "CALL_CLICKS",
            "WEBSITE_CLICKS",
            "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
            "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
            "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
            "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        ],
        "dailyRange.startDate.year": startDate.year,
        "dailyRange.startDate.month": startDate.month,
        "dailyRange.startDate.day": startDate.day,
        "dailyRange.endDate.year": endDate.year,
        "dailyRange.endDate.month": endDate.month,
        "dailyRange.endDate.day": endDate.day,
    });

    return response.data;
}

// ─── Google Search Console API ─────────────────────────────────────────

// List all verified sites in Search Console
export async function listGSCSites(accessToken: string) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await searchconsole.sites.list();
    const sites = response.data.siteEntry || [];

    return sites
        .filter((site) => site.siteUrl && site.permissionLevel !== "siteUnverifiedUser")
        .map((site) => ({
            siteUrl: site.siteUrl!,
            permissionLevel: site.permissionLevel || "unknown",
        }));
}

// GSC Search Analytics — overall performance metrics
export async function getGSCSearchAnalytics(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
): Promise<GSCQueryResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["date"],
            rowLimit: 500,
        },
    });

    return response.data;
}

// GSC Search Analytics — top queries (keywords)
export async function getGSCTopQueries(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
): Promise<GSCQueryResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["query"],
            rowLimit: 20,
        },
    });

    return response.data;
}

// GSC Search Analytics — top pages
export async function getGSCTopPages(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
): Promise<GSCQueryResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["page"],
            rowLimit: 10,
        },
    });

    return response.data;
}

// GSC Search Analytics — performance by device
export async function getGSCDeviceBreakdown(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
): Promise<GSCQueryResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["device"],
            rowLimit: 10,
        },
    });

    return response.data;
}

// GBP Search Keywords — monthly search terms used to find the business
export async function getGBPSearchKeywords(
    accessToken: string,
    locationId: string,
    startMonth: { year: number; month: number },
    endMonth: { year: number; month: number },
): Promise<GBPKeywordsResponse> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const businessPerformance = google.businessprofileperformance({
        version: "v1",
        auth: oauth2Client,
    });

    const response = await businessPerformance.locations.searchkeywords.impressions.monthly.list({
        parent: `locations/${locationId}`,
        "monthlyRange.startMonth.year": startMonth.year,
        "monthlyRange.startMonth.month": startMonth.month,
        "monthlyRange.endMonth.year": endMonth.year,
        "monthlyRange.endMonth.month": endMonth.month,
    });

    return response.data;
}
