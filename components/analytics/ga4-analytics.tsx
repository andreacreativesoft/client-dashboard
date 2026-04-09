"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BAR_COLORS = ["#2A5959", "#B5C3BE", "#F2612E", "#B5C3BE", "#2E2E2E"];
function barColor(i: number) { return BAR_COLORS[i % BAR_COLORS.length]!; }
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import type { GA4AnalyticsData } from "@/lib/actions/analytics";

// Auto-detected GA4 events (built-in) — everything else is custom/CTA
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

type Props = {
  clientsWithGA4: Array<{
    clientId: string;
    clientName: string;
    propertyName: string | null;
  }>;
  isAdmin: boolean;
  initialClientId?: string;
};

export function GA4Analytics({ clientsWithGA4, isAdmin, initialClientId }: Props) {
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId || clientsWithGA4[0]?.clientId || ""
  );
  const [period, setPeriod] = useState<"7d" | "30d">("30d");
  const { t } = useLanguage();

  // Sync with header client selector
  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [initialClientId]);
  const [data, setData] = useState<GA4AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // For admins, need a selected client; for clients, server action auto-detects
      if (isAdmin && !selectedClientId) return;
      setLoading(true);
      setError(null);

      try {
        // Dynamic import to avoid bundling server action in client
        const { fetchGA4Analytics } = await import("@/lib/actions/analytics");
        const result = await fetchGA4Analytics(
          isAdmin ? selectedClientId : undefined,
          period,
          forceRefresh
        );

        if (result.success && result.data) {
          setData(result.data);
          setCached(!!result.cached);
        } else {
          setError(result.error || "Failed to fetch data");
          setData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch GA4 data");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [selectedClientId, period, isAdmin]
  );

  useEffect(() => {
    if (isAdmin && !selectedClientId) return;
    fetchData();
  }, [selectedClientId, period, fetchData, isAdmin]);

  // Only show empty state for admins with no GA4 clients
  if (isAdmin && clientsWithGA4.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-lg font-medium">{t("ga4.no_integrations")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("ga4.no_integrations_desc")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate custom events (CTAs) from auto-tracked events
  const customEvents = data?.events.filter((e) => !GA4_AUTO_EVENTS.has(e.eventName)) || [];
  const autoEvents = data?.events.filter((e) => GA4_AUTO_EVENTS.has(e.eventName)) || [];

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Google Analytics</h2>
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
                period === "7d"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              {t("ga4.7_days")}
            </button>
            <button
              onClick={() => setPeriod("30d")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === "30d"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              {t("ga4.30_days")}
            </button>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("ga4.refresh")}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Data display */}
      {data && (
        <>
          {/* Overview metrics */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.sessions)}</p>
                <p className="text-xs font-medium text-muted-foreground">{t("ga4.sessions")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalUsers)}</p>
                <p className="text-xs font-medium text-muted-foreground">{t("ga4.users")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.pageViews)}</p>
                <p className="text-xs font-medium text-muted-foreground">{t("ga4.page_views")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {Math.round(data.overview.bounceRate * 100)}%
                </p>
                <p className="text-xs font-medium text-muted-foreground">{t("ga4.bounce_rate")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {Math.round(data.overview.avgSessionDuration)}s
                </p>
                <p className="text-xs font-medium text-muted-foreground">{t("ga4.avg_duration")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Traffic chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("ga4.sessions")} ({period === "7d" ? t("ga4.7_days") : t("ga4.30_days")})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.daily.length > 0 ? (
                <>
                  <div className="flex h-32 items-end gap-1">
                    {data.daily.map((day, i) => {
                      const maxSessions = Math.max(...data.daily.map((d) => d.sessions), 1);
                      const height = day.sessions > 0
                        ? Math.max((day.sessions / maxSessions) * 100, 4)
                        : 2;
                      // Format date for tooltip
                      const dateStr = day.date.length === 8
                        ? `${day.date.slice(0, 4)}-${day.date.slice(4, 6)}-${day.date.slice(6, 8)}`
                        : day.date;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 rounded-t transition-all"
                          style={{ height: `${height}%`, backgroundColor: i % 2 === 0 ? "#2A5959" : "#F2612E" }}
                          title={`${dateStr}: ${day.sessions} sessions, ${day.users} users, ${day.pageViews} views`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {data.daily[0]?.date
                        ? `${data.daily[0].date.slice(4, 6)}/${data.daily[0].date.slice(6, 8)}`
                        : ""}
                    </span>
                    <span>{t("analytics.today")}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("ga4.no_traffic")}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* CTA / Custom Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("ga4.cta_custom_events")}
                  {customEvents.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({customEvents.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customEvents.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t("ga4.no_custom_events")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("ga4.cta_setup_hint")}
                    </p>
                    <code className="block rounded bg-muted p-2 text-xs">
                      gtag(&apos;event&apos;, &apos;cta_click&apos;, &#123; button: &apos;call_now&apos; &#125;);
                    </code>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customEvents.map((event, i) => {
                      const maxCount = Math.max(...customEvents.map((e) => e.eventCount), 1);
                      const percent = Math.round((event.eventCount / maxCount) * 100);
                      return (
                        <div key={event.eventName} className="flex items-center gap-4">
                          <span className="w-[200px] shrink-0 text-[14px] text-[#2E2E2E]">{event.eventName}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: barColor(i) }} />
                          </div>
                          <span className="shrink-0 text-[14px] font-bold text-[#2E2E2E]">{formatNumber(event.eventCount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto-tracked events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("ga4.auto_events")}</CardTitle>
              </CardHeader>
              <CardContent>
                {autoEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("ga4.no_events")}</p>
                ) : (
                  <div className="space-y-2">
                    {autoEvents.slice(0, 8).map((event) => (
                      <div
                        key={event.eventName}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{event.eventName}</span>
                        <span className="font-medium">{formatNumber(event.eventCount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("ga4.top_pages")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("ga4.no_pages")}</p>
                ) : (
                  <div className="space-y-4">
                    {data.topPages.slice(0, 8).map((page, i) => {
                      const maxViews = Math.max(...data.topPages.slice(0, 8).map((p) => p.pageViews), 1);
                      const percent = Math.round((page.pageViews / maxViews) * 100);
                      return (
                        <div key={page.pagePath} className="flex items-center gap-4">
                          <span className="w-[200px] shrink-0 truncate text-[14px] text-[#2E2E2E]" title={page.pagePath}>{page.pagePath}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: barColor(i) }} />
                          </div>
                          <span className="shrink-0 text-[14px] font-bold text-[#2E2E2E]">{formatNumber(page.pageViews)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("ga4.traffic_sources")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.trafficSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("ga4.no_sources")}</p>
                ) : (
                  <div className="space-y-4">
                    {data.trafficSources.map((source, i) => {
                      const maxSessions = Math.max(...data.trafficSources.map((s) => s.sessions), 1);
                      const percent = Math.round((source.sessions / maxSessions) * 100);
                      return (
                        <div key={source.channel} className="flex items-center gap-4">
                          <span className="w-[200px] shrink-0 text-[14px] text-[#2E2E2E]">{source.channel}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: barColor(i) }} />
                          </div>
                          <span className="shrink-0 text-[14px] font-bold text-[#2E2E2E]">{formatNumber(source.sessions)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
