import { google } from "googleapis";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

// Scopes required for GA4 and Google Business Profile
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/business.manage",
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

// Token encryption for secure storage
export function encryptToken(token: string): string {
  if (!TOKEN_ENCRYPTION_KEY) {
    console.warn("TOKEN_ENCRYPTION_KEY not set, storing token in plain text");
    return token;
  }

  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

export function decryptToken(encryptedToken: string): string {
  if (!TOKEN_ENCRYPTION_KEY) {
    return encryptedToken;
  }

  const [ivHex, encrypted] = encryptedToken.split(":");
  if (!ivHex || !encrypted) {
    return encryptedToken; // Not encrypted
  }

  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(TOKEN_ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// GA4 Data API
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
    } catch {
      // Account may not have business profile access
      continue;
    }
  }

  return locations;
}

export async function getGBPInsights(
  accessToken: string,
  locationName: string,
  _startDate: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  _endDate: string // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const businessInfo = google.mybusinessbusinessinformation({
    version: "v1",
    auth: oauth2Client,
  });

  // Note: The actual insights API has specific requirements
  // This is a simplified version - real implementation needs proper date handling
  try {
    const response = await businessInfo.locations.get({
      name: locationName,
      readMask: "name,title,websiteUri,phoneNumbers",
    });

    return response.data;
  } catch (err) {
    console.error("GBP insights error:", err);
    throw err;
  }
}
