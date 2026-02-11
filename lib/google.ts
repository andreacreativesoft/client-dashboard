import { google } from "googleapis";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

// Scopes required for GA4, Google Business Profile, and Search Console
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

export function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
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

export async function getTokensFromCode(
  code: string
): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Invalid token response from Google");
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
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

// Token encryption for secure storage (random salt per token)
export function encryptToken(token: string): string {
  if (!TOKEN_ENCRYPTION_KEY) {
    console.warn("TOKEN_ENCRYPTION_KEY not set, storing token in plain text");
    return token;
  }

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Format: salt:iv:encrypted (3 parts)
  return salt.toString("hex") + ":" + iv.toString("hex") + ":" + encrypted;
}

export function decryptToken(encryptedToken: string): string {
  if (!TOKEN_ENCRYPTION_KEY) {
    return encryptedToken;
  }

  const parts = encryptedToken.split(":");

  if (parts.length === 3) {
    // New format: salt:iv:encrypted
    const [saltHex, ivHex, encrypted] = parts;
    if (!saltHex || !ivHex || !encrypted) return encryptedToken;

    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, salt, 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } else if (parts.length === 2) {
    // Legacy format: iv:encrypted (fixed salt)
    const [ivHex, encrypted] = parts;
    if (!ivHex || !encrypted) return encryptedToken;

    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  return encryptedToken; // Not encrypted
}

// GA4 Data API — overview metrics by day
export async function getGA4Data(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
) {
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
  endDate: string
) {
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
  endDate: string
) {
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
      metrics: [
        { name: "eventCount" },
        { name: "totalUsers" },
      ],
      dimensions: [{ name: "eventName" }],
      orderBys: [
        { metric: { metricName: "eventCount" }, desc: true },
      ],
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
  endDate: string
) {
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
        { name: "screenPageViews" },
        { name: "totalUsers" },
      ],
      dimensions: [{ name: "pagePath" }],
      orderBys: [
        { metric: { metricName: "screenPageViews" }, desc: true },
      ],
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
  endDate: string
) {
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
      ],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      orderBys: [
        { metric: { metricName: "sessions" }, desc: true },
      ],
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
  console.log(`GBP: Found ${accounts.length} accounts`, accounts.map(a => ({ name: a.name, accountName: a.accountName })));

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
      console.error(`Failed to list locations for account ${account.name}:`, err instanceof Error ? err.message : err);
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
  endDate: { year: number; month: number; day: number }
) {
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
  endDate: string
) {
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
  endDate: string
) {
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
  endDate: string
) {
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
  endDate: string
) {
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
  endMonth: { year: number; month: number }
) {
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
