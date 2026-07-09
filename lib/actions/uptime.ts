"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type UptimeStatus = "up" | "down" | "degraded";

export interface UptimeCheckRow {
    status: UptimeStatus;
    http_status: number | null;
    response_ms: number | null;
    checked_at: string;
    error: string | null;
}

export interface UptimeIncidentRow {
    started_at: string;
    resolved_at: string | null;
    last_status: "down" | "degraded";
}

export interface UptimeSummary {
    enabled: boolean;
    latest: UptimeCheckRow | null;
    /** Share of "up" checks over the window, 0–100, or null when no checks. */
    uptimePct: number | null;
    /** Average response time (ms) over the window, or null. */
    avgResponseMs: number | null;
    checksCount: number;
    openIncidents: number;
    recentIncidents: UptimeIncidentRow[];
    windowDays: number;
}

const WINDOW_DAYS = 30;

/**
 * Uptime snapshot for a website: current status, 30-day availability, response
 * time and recent incidents. Returns an empty (but enabled-aware) summary when
 * monitoring is off or no checks have been recorded yet.
 */
export async function getUptimeForWebsite(websiteId: string): Promise<UptimeSummary> {
    const auth = await requireAdmin();
    const empty: UptimeSummary = {
        enabled: false,
        latest: null,
        uptimePct: null,
        avgResponseMs: null,
        checksCount: 0,
        openIncidents: 0,
        recentIncidents: [],
        windowDays: WINDOW_DAYS,
    };
    if (!auth.success) return empty;

    const supabase = await createClient();

    const { data: website } = await supabase
        .from("websites")
        .select("uptime_enabled")
        .eq("id", websiteId)
        .single();

    const enabled = !!website?.uptime_enabled;
    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();

    const [latestRes, windowRes, incidentsRes] = await Promise.all([
        supabase
            .from("uptime_checks")
            .select("status, http_status, response_ms, checked_at, error")
            .eq("website_id", websiteId)
            .order("checked_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("uptime_checks")
            .select("status, response_ms")
            .eq("website_id", websiteId)
            .gte("checked_at", since),
        supabase
            .from("uptime_incidents")
            .select("started_at, resolved_at, last_status")
            .eq("website_id", websiteId)
            .order("started_at", { ascending: false })
            .limit(5),
    ]);

    const windowChecks = (windowRes.data ?? []) as {
        status: UptimeStatus;
        response_ms: number | null;
    }[];
    const checksCount = windowChecks.length;
    const upCount = windowChecks.filter((c) => c.status === "up").length;
    const responseTimes = windowChecks
        .map((c) => c.response_ms)
        .filter((ms): ms is number => typeof ms === "number");

    const incidents = (incidentsRes.data ?? []) as UptimeIncidentRow[];

    return {
        enabled,
        latest: (latestRes.data as UptimeCheckRow | null) ?? null,
        uptimePct: checksCount > 0 ? Math.round((upCount / checksCount) * 1000) / 10 : null,
        avgResponseMs:
            responseTimes.length > 0
                ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                : null,
        checksCount,
        openIncidents: incidents.filter((i) => i.resolved_at === null).length,
        recentIncidents: incidents,
        windowDays: WINDOW_DAYS,
    };
}
