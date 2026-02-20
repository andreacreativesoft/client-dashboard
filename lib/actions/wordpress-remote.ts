"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { encryptToken, decryptToken } from "@/lib/google";
import {
  testWPConnection,
  fetchDebugLog,
  type WPApiCredentials,
} from "@/lib/wordpress/api-client";
import type {
  Integration,
  WPDebugLogEntry,
  WPDebugLogLevel,
  WPDebugLogSummary,
} from "@/types/database";

// ---------------------------------------------------------------------------
// WordPress integration CRUD
// ---------------------------------------------------------------------------

export async function addWordPressIntegration(
  clientId: string,
  siteUrl: string,
  username: string,
  appPassword: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  // Test connection first
  const credentials: WPApiCredentials = { siteUrl, username, appPassword };
  const test = await testWPConnection(credentials);

  if (!test.success) {
    return {
      success: false,
      error: `Connection failed: ${test.error || "Could not reach WordPress REST API"}`,
    };
  }

  const supabase = await createClient();
  const encryptedPassword = encryptToken(appPassword);

  const { error } = await supabase.from("integrations").upsert(
    {
      client_id: clientId,
      type: "wordpress" as const,
      account_id: siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      account_name: username,
      access_token_encrypted: encryptedPassword,
      refresh_token_encrypted: null,
      token_expires_at: null,
      metadata: {
        site_url: siteUrl.replace(/\/+$/, ""),
        wp_user_id: test.data?.id,
        wp_user_name: test.data?.name,
        connected_at: new Date().toISOString(),
      },
      is_active: true,
    },
    { onConflict: "client_id,type,account_id" }
  );

  if (error) {
    console.error("Failed to save WordPress integration:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function testWordPressConnection(
  siteUrl: string,
  username: string,
  appPassword: string
): Promise<{ success: boolean; error?: string; userName?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const credentials: WPApiCredentials = { siteUrl, username, appPassword };
  const result = await testWPConnection(credentials);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, userName: result.data?.name };
}

// ---------------------------------------------------------------------------
// Debug log helpers
// ---------------------------------------------------------------------------

function getCredentialsFromIntegration(integration: Integration): WPApiCredentials {
  const metadata = integration.metadata as Record<string, unknown>;
  const siteUrl = (metadata?.site_url as string) || `https://${integration.account_id}`;
  const username = integration.account_name || "";
  const appPassword = integration.access_token_encrypted
    ? decryptToken(integration.access_token_encrypted)
    : "";

  return { siteUrl, username, appPassword };
}

/**
 * Parse WordPress debug.log lines into structured entries.
 */
function parseDebugLogLines(lines: string[]): WPDebugLogEntry[] {
  const entries: WPDebugLogEntry[] = [];
  // WP debug.log format: [DD-Mon-YYYY HH:MM:SS UTC] PHP Warning: message in /path on line N
  const timestampRegex = /^\[([^\]]+)\]\s*(.*)$/;
  const levelRegex = /^PHP\s+(Fatal\s+error|Parse\s+error|Warning|Notice|Deprecated|Strict\s+Standards|Recoverable\s+fatal\s+error)/i;
  const fileLineRegex = /\s+in\s+(.+?)\s+on\s+line\s+(\d+)\s*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let timestamp = "";
    let rest = line;

    const tsMatch = timestampRegex.exec(line);
    if (tsMatch) {
      timestamp = tsMatch[1] ?? "";
      rest = tsMatch[2] ?? "";
    }

    // Determine level
    let level: WPDebugLogLevel = "info";
    const levelMatch = levelRegex.exec(rest);
    if (levelMatch) {
      const raw = (levelMatch[1] ?? "").toLowerCase();
      if (raw.includes("fatal") || raw.includes("parse")) level = "fatal";
      else if (raw === "warning") level = "warning";
      else if (raw === "notice") level = "notice";
      else if (raw === "deprecated" || raw.includes("strict")) level = "deprecated";
      else level = "error";
    } else if (/error/i.test(rest)) {
      level = "error";
    } else if (/warning/i.test(rest)) {
      level = "warning";
    } else if (/notice/i.test(rest)) {
      level = "notice";
    } else if (/deprecated/i.test(rest)) {
      level = "deprecated";
    }

    // Extract file and line
    let file: string | undefined;
    let lineNum: number | undefined;
    const flMatch = fileLineRegex.exec(rest);
    if (flMatch) {
      file = flMatch[1];
      lineNum = parseInt(flMatch[2] ?? "0", 10);
    }

    entries.push({
      timestamp,
      level,
      message: rest,
      file,
      line: lineNum,
      raw: line,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Fetch debug log for a single website
// ---------------------------------------------------------------------------

export async function getDebugLogForWebsite(
  websiteId: string,
  lineCount: number = 200
): Promise<{
  success: boolean;
  error?: string;
  entries?: WPDebugLogEntry[];
  debugEnabled?: boolean;
  logEnabled?: boolean;
  fileSize?: number;
  lastModified?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get website to find client_id
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id, url")
    .eq("id", websiteId)
    .single();

  if (!website) return { success: false, error: "Website not found" };

  // Find WordPress integration for this client
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("client_id", website.client_id)
    .eq("type", "wordpress")
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) {
    return { success: false, error: "No WordPress integration configured" };
  }

  // Match by site URL if multiple, otherwise use first
  const websiteHost = new URL(website.url).hostname;
  const integration = (integrations as Integration[]).find((i) => {
    const meta = i.metadata as Record<string, unknown>;
    const siteUrl = (meta?.site_url as string) || "";
    try {
      return new URL(siteUrl).hostname === websiteHost;
    } catch {
      return false;
    }
  }) || integrations[0] as Integration;

  const credentials = getCredentialsFromIntegration(integration);
  const result = await fetchDebugLog(credentials, lineCount);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const entries = parseDebugLogLines(result.data?.lines || []);

  return {
    success: true,
    entries,
    debugEnabled: result.data?.debug_enabled,
    logEnabled: result.data?.log_enabled,
    fileSize: result.data?.file_size,
    lastModified: result.data?.last_modified,
  };
}

// ---------------------------------------------------------------------------
// Fetch debug log summaries for ALL websites (admin dashboard overview)
// ---------------------------------------------------------------------------

export async function getAllDebugLogSummaries(): Promise<WPDebugLogSummary[]> {
  const auth = await requireAdmin();
  if (!auth.success) return [];

  const supabase = await createClient();

  // Get all active WordPress integrations
  const { data: wpIntegrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("type", "wordpress")
    .eq("is_active", true);

  if (!wpIntegrations || wpIntegrations.length === 0) return [];

  // Get all websites and clients for these integrations
  const clientIds = [...new Set((wpIntegrations as Integration[]).map((i) => i.client_id))];

  const { data: websites } = await supabase
    .from("websites")
    .select("id, client_id, name, url")
    .in("client_id", clientIds)
    .eq("is_active", true);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name")
    .in("id", clientIds);

  if (!websites || !clients) return [];

  const clientMap = new Map(clients.map((c) => [c.id, c.business_name]));

  // For each integration, fetch debug log
  const summaries: WPDebugLogSummary[] = [];

  // Process integrations concurrently (max 5 at a time)
  const integrationsList = wpIntegrations as Integration[];
  const batchSize = 5;

  for (let i = 0; i < integrationsList.length; i += batchSize) {
    const batch = integrationsList.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (integration) => {
        const credentials = getCredentialsFromIntegration(integration);
        const meta = integration.metadata as Record<string, unknown>;
        const siteUrl = (meta?.site_url as string) || credentials.siteUrl;

        // Find matching website
        let siteHost: string;
        try {
          siteHost = new URL(siteUrl).hostname;
        } catch {
          return null;
        }

        const matchingWebsite = websites.find((w) => {
          try {
            return new URL(w.url).hostname === siteHost;
          } catch {
            return false;
          }
        });

        if (!matchingWebsite) return null;

        const result = await fetchDebugLog(credentials, 500);
        if (!result.success || !result.data) return null;

        const entries = parseDebugLogLines(result.data.lines);
        const fatal = entries.filter((e) => e.level === "fatal").length;
        const errors = entries.filter((e) => e.level === "error").length;
        const warnings = entries.filter((e) => e.level === "warning").length;
        const notices = entries.filter((e) => e.level === "notice").length;
        const deprecated = entries.filter((e) => e.level === "deprecated").length;

        return {
          website_id: matchingWebsite.id,
          website_name: matchingWebsite.name,
          client_id: integration.client_id,
          client_name: clientMap.get(integration.client_id) || "Unknown",
          site_url: siteUrl,
          total: entries.length,
          fatal,
          errors,
          warnings,
          notices,
          deprecated,
          last_checked: new Date().toISOString(),
          entries: entries.slice(-50), // Last 50 entries for preview
        } satisfies WPDebugLogSummary;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        summaries.push(result.value);
      }
    }
  }

  // Sort by severity: fatal > errors > warnings
  summaries.sort((a, b) => {
    if (a.fatal !== b.fatal) return b.fatal - a.fatal;
    if (a.errors !== b.errors) return b.errors - a.errors;
    return b.warnings - a.warnings;
  });

  return summaries;
}
