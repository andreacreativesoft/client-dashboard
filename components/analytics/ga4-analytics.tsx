"use client";

import { useState, useEffect, useCallback } from "react";

import { SiteBarChart } from "@/components/charts/bar-chart";
import { SiteDonutChart } from "@/components/charts/donut-chart";
import { SiteLineChart } from "@/components/charts/line-chart";
import { useSelectedWebsite } from "@/components/layout/selected-website-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Skeleton } from "@/components/ui/skeleton";
import type { GA4AnalyticsData } from "@/lib/actions/analytics";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatNumber } from "@/lib/utils";

// Auto-detected GA4 events (built-in) — everything else is a custom/contact action
const GA4_AUTO_EVENTS = new Set([
    "first_visit",
    "session_start",
    "page_view",
    "scroll",
    "click",
    "view_search_results",
    "file_download",
    "video_start",
    "video_progress",
    "video_complete",
    "form_start",
    "form_submit",
    "user_engagement",
]);

/** Regroupe les canaux GA4 (en anglais) dans le vocabulaire client. */
function channelKey(channel: string): TranslationKey {
    const c = channel.toLowerCase();
    if (c.includes("social")) return "ga4.channel_social";
    if (c.includes("search")) return "ga4.channel_search";
    if (c === "direct") return "ga4.channel_direct";
    return "ga4.channel_other";
}

/** "2:34" pour un temps moyen exprimé en secondes. */
function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GA4Analytics() {
    // Le site affiché vient du sélecteur global (sidebar) — plus de sélection par page.
    const { websites, selectedWebsiteId } = useSelectedWebsite();
    const [period, setPeriod] = useState<"7d" | "30d">("30d");
    const { t } = useLanguage();

    const [data, setData] = useState<GA4AnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cached, setCached] = useState(false);

    const fetchData = useCallback(
        async (forceRefresh = false) => {
            if (!selectedWebsiteId) return;
            setLoading(true);

            try {
                const { fetchGA4Analytics } = await import("@/lib/actions/analytics");
                const result = await fetchGA4Analytics(selectedWebsiteId, period, forceRefresh);
                if (result.success && result.data) {
                    setData(result.data);
                    setCached(!!result.cached);
                } else {
                    setData(null);
                }
            } catch {
                setData(null);
            } finally {
                setLoading(false);
            }
        },
        [selectedWebsiteId, period],
    );

    useEffect(() => {
        setData(null);
        if (selectedWebsiteId) fetchData();
    }, [selectedWebsiteId, period, fetchData]);

    // Client sans aucun site → rien à afficher.
    if (websites.length === 0) {
        return <NotConnected t={t} />;
    }

    // Contact actions = custom events only (auto-tracked GA4 events stay hidden —
    // they're noise for a non-technical client).
    const contactActions = data?.events.filter((e) => !GA4_AUTO_EVENTS.has(e.eventName)) || [];

    // Merge traffic channels into the client-facing buckets before charting.
    const sourceBuckets = new Map<string, number>();
    for (const s of data?.trafficSources ?? []) {
        const label = t(channelKey(s.channel));
        sourceBuckets.set(label, (sourceBuckets.get(label) ?? 0) + s.sessions);
    }
    const sourceData = [...sourceBuckets.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    const resolving = !selectedWebsiteId;

    return (
        <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{t("ga4.section_title")}</h2>
                    {data && (
                        <Badge variant="outline" className="text-xs">
                            {data.propertyName}
                        </Badge>
                    )}
                    {cached && (
                        <Badge variant="secondary" className="text-xs">
                            {t("ga4.cached")}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Period selector */}
                    <div className="flex rounded-md border border-input">
                        <button
                            onClick={() => setPeriod("7d")}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                period === "7d" ? "bg-foreground text-background" : "hover:bg-muted"
                            }`}>
                            {t("ga4.7_days")}
                        </button>
                        <button
                            onClick={() => setPeriod("30d")}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                period === "30d"
                                    ? "bg-foreground text-background"
                                    : "hover:bg-muted"
                            }`}>
                            {t("ga4.30_days")}
                        </button>
                    </div>

                    {/* Refresh button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={loading || resolving}>
                        {loading ? t("common.loading") : t("ga4.refresh")}
                    </Button>
                </div>
            </div>

            {/* Loading / resolving state */}
            {(loading || resolving) && !data && (
                <div className="grid gap-3 grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
            )}

            {/* Not connected for this site */}
            {!loading && !resolving && !data && <NotConnected t={t} inline />}

            {/* Data display */}
            {data && (
                <>
                    {/* Overview metrics — kept plain: visitors + time spent */}
                    <div className="grid gap-3 grid-cols-2">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.overview.sessions)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("ga4.sessions")}
                                    </p>
                                    <InfoHint text={t("ga4.hint_visitors")} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatDuration(data.overview.avgSessionDuration)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("ga4.avg_duration")}
                                    </p>
                                    <InfoHint text={t("ga4.hint_duration")} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Traffic chart — visitors over time */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {t("ga4.sessions")} (
                                {period === "7d" ? t("ga4.7_days") : t("ga4.30_days")})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.daily.length > 0 ? (
                                <SiteLineChart
                                    data={data.daily.map((day) => ({
                                        label:
                                            day.date.length === 8
                                                ? `${day.date.slice(4, 6)}/${day.date.slice(6, 8)}`
                                                : day.date,
                                        value: day.sessions,
                                    }))}
                                    primaryLabel={t("ga4.sessions")}
                                    height={240}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t("ga4.no_traffic")}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Contact actions (custom events) — only when there are any */}
                        {contactActions.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-1.5">
                                        {t("ga4.cta_custom_events")}
                                        <InfoHint text={t("ga4.hint_actions")} />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SiteBarChart
                                        layout="horizontal"
                                        data={contactActions.map((e) => ({
                                            label: e.eventName,
                                            value: e.eventCount,
                                        }))}
                                        height={Math.max(200, contactActions.length * 36)}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {/* Top Pages */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-1.5">
                                    {t("ga4.top_pages")}
                                    <InfoHint text={t("ga4.hint_pages")} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {data.topPages.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("ga4.no_pages")}
                                    </p>
                                ) : (
                                    <SiteBarChart
                                        layout="horizontal"
                                        data={data.topPages.slice(0, 8).map((p) => ({
                                            label: p.pagePath,
                                            value: p.pageViews,
                                        }))}
                                        height={Math.max(
                                            200,
                                            data.topPages.slice(0, 8).length * 36,
                                        )}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Traffic Sources */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-1.5">
                                    {t("ga4.traffic_sources")}
                                    <InfoHint text={t("ga4.hint_sources")} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sourceData.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("ga4.no_sources")}
                                    </p>
                                ) : (
                                    <SiteDonutChart data={sourceData} />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

/** État « pas encore connecté » (calme, orienté client). */
function NotConnected({ t, inline }: { t: (k: TranslationKey) => string; inline?: boolean }) {
    const body = (
        <div className={inline ? "" : "text-center"}>
            <p className="text-lg font-medium">{t("ga4.no_integrations")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("ga4.no_integrations_desc")}</p>
        </div>
    );
    return (
        <Card>
            <CardContent className="p-6">{body}</CardContent>
        </Card>
    );
}
