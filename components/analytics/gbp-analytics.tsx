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
import type { GBPAnalyticsData } from "@/lib/actions/analytics";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatNumber } from "@/lib/utils";

export function GBPAnalytics() {
    const { websites, selectedWebsiteId } = useSelectedWebsite();
    const [period, setPeriod] = useState<"7d" | "30d">("30d");
    const { t } = useLanguage();

    const [data, setData] = useState<GBPAnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cached, setCached] = useState(false);

    const fetchData = useCallback(
        async (forceRefresh = false) => {
            if (!selectedWebsiteId) return;
            setLoading(true);

            try {
                const { fetchGBPAnalytics } = await import("@/lib/actions/analytics");
                const result = await fetchGBPAnalytics(selectedWebsiteId, period, forceRefresh);
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
                    <h2 className="text-lg font-semibold">{t("gbp.section_title")}</h2>
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
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
            )}

            {/* Not connected for this site */}
            {!loading && !resolving && !data && <NotConnected t={t} inline />}

            {/* Data */}
            {data && (
                <>
                    {/* Interaction totals + a single "appearances" card */}
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.totals.callClicks)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gbp.call_clicks")}
                                    </p>
                                    <InfoHint text={t("gbp.hint_calls")} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.totals.directionRequests)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gbp.direction_requests")}
                                    </p>
                                    <InfoHint text={t("gbp.hint_directions")} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.totals.websiteClicks)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gbp.website_clicks")}
                                    </p>
                                    <InfoHint text={t("gbp.hint_website_clicks")} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-2xl font-bold">
                                    {formatNumber(data.totals.totalImpressions)}
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("gbp.impressions")}
                                    </p>
                                    <InfoHint text={t("gbp.hint_impressions")} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Daily interactions chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {t("gbp.daily_interactions")} (
                                {period === "7d" ? t("ga4.7_days") : t("ga4.30_days")})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.daily.length > 0 ? (
                                <SiteLineChart
                                    data={data.daily.map((day) => ({
                                        label: day.date.slice(5),
                                        value:
                                            day.directionRequests +
                                            day.callClicks +
                                            day.websiteClicks,
                                    }))}
                                    primaryLabel={t("gbp.total_interactions")}
                                    height={240}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t("gbp.no_interactions")}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Interaction breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-1.5">
                                    {t("gbp.interaction_breakdown")}
                                    <InfoHint text={t("gbp.hint_interactions")} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SiteBarChart
                                    layout="horizontal"
                                    data={[
                                        {
                                            label: t("gbp.direction_requests"),
                                            value: data.totals.directionRequests,
                                        },
                                        {
                                            label: t("gbp.call_clicks"),
                                            value: data.totals.callClicks,
                                        },
                                        {
                                            label: t("gbp.website_clicks"),
                                            value: data.totals.websiteClicks,
                                        },
                                    ]}
                                    height={200}
                                />
                            </CardContent>
                        </Card>

                        {/* Search Keywords */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-1.5">
                                    {t("gbp.search_keywords")}
                                    <InfoHint text={t("gbp.hint_keywords")} />
                                    {data.searchKeywords.length > 0 && (
                                        <span className="text-sm font-normal text-muted-foreground">
                                            ({t("gbp.monthly")})
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {data.searchKeywords.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("gbp.no_keywords")}
                                    </p>
                                ) : (
                                    <SiteBarChart
                                        layout="horizontal"
                                        data={data.searchKeywords.slice(0, 10).map((kw) => ({
                                            label: kw.keyword,
                                            value: kw.impressions,
                                        }))}
                                        height={Math.max(
                                            200,
                                            data.searchKeywords.slice(0, 10).length * 36,
                                        )}
                                    />
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
    return (
        <Card>
            <CardContent className="p-6">
                <div className={inline ? "" : "text-center"}>
                    <p className="text-lg font-medium">{t("gbp.no_integrations")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("gbp.no_integrations_desc")}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
