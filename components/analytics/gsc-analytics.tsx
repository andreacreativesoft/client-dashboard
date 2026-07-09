"use client";

import { useState, useEffect, useCallback } from "react";

import { SiteBarChart } from "@/components/charts/bar-chart";
import { SiteLineChart } from "@/components/charts/line-chart";
import { useSelectedWebsite } from "@/components/layout/selected-website-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Skeleton } from "@/components/ui/skeleton";
import type { GSCAnalyticsData } from "@/lib/actions/analytics";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatNumber } from "@/lib/utils";

export function GSCAnalytics() {
    const { websites, selectedWebsiteId } = useSelectedWebsite();
    const [period, setPeriod] = useState<"7d" | "30d">("30d");
    const { t } = useLanguage();

    const [data, setData] = useState<GSCAnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cached, setCached] = useState(false);

    const fetchData = useCallback(
        async (forceRefresh = false) => {
            if (!selectedWebsiteId) return;
            setLoading(true);

            try {
                const { fetchGSCAnalytics } = await import("@/lib/actions/analytics");
                const result = await fetchGSCAnalytics(selectedWebsiteId, period, forceRefresh);
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

    if (websites.length === 0) {
        return <NotConnected t={t} />;
    }

    const siteLabel = websites.find((w) => w.id === selectedWebsiteId)?.name || "";
    const resolving = !selectedWebsiteId;

    return (
        <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{t("gsc.section_title")}</h2>
                    {data && siteLabel && (
                        <Badge variant="outline" className="text-xs">
                            {siteLabel}
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
                    {/* Overview metrics — found you + appeared on Google */}
                    <div className="grid gap-3 grid-cols-2">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.overview.totalClicks)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gsc.total_clicks")}
                                    </p>
                                    <InfoHint text={t("gsc.hint_clicks")} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.overview.totalImpressions)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gsc.total_impressions")}
                                    </p>
                                    <InfoHint text={t("gsc.hint_impressions")} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Clicks chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {t("gsc.organic_clicks")} (
                                {period === "7d" ? t("ga4.7_days") : t("ga4.30_days")})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.daily.length > 0 ? (
                                <SiteLineChart
                                    data={data.daily.map((day) => ({
                                        label: day.date.slice(5),
                                        value: day.clicks,
                                    }))}
                                    primaryLabel={t("gsc.total_clicks")}
                                    height={240}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t("gsc.no_search_data")}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* What people search to find you */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-1.5">
                                {t("gsc.top_keywords")}
                                <InfoHint text={t("gsc.hint_keywords")} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.topQueries.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t("gsc.no_keywords")}
                                </p>
                            ) : (
                                <SiteBarChart
                                    layout="horizontal"
                                    data={data.topQueries.slice(0, 10).map((q) => ({
                                        label: q.query,
                                        value: q.clicks,
                                    }))}
                                    height={Math.max(200, data.topQueries.slice(0, 10).length * 36)}
                                />
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

/** État « pas encore connecté » (calme, orienté client). */
function NotConnected({ t, inline }: { t: (k: TranslationKey) => string; inline?: boolean }) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className={inline ? "" : "text-center"}>
                    <p className="text-lg font-medium">{t("gsc.no_integrations")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("gsc.no_integrations_desc")}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
