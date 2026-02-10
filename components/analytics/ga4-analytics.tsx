"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
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
            <p className="text-lg font-medium">No GA4 Integrations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Google Analytics 4 in a client&apos;s settings to see website analytics and CTA tracking here.
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
              Cached
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Client selector (admin only, multiple clients) */}
          {isAdmin && clientsWithGA4.length > 1 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {clientsWithGA4.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName}
                </option>
              ))}
            </select>
          )}

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
              7 days
            </button>
            <button
              onClick={() => setPeriod("30d")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === "30d"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              30 days
            </button>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
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
                <p className="text-xs font-medium text-muted-foreground">Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalUsers)}</p>
                <p className="text-xs font-medium text-muted-foreground">Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.pageViews)}</p>
                <p className="text-xs font-medium text-muted-foreground">Page Views</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {Math.round(data.overview.bounceRate * 100)}%
                </p>
                <p className="text-xs font-medium text-muted-foreground">Bounce Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {Math.round(data.overview.avgSessionDuration)}s
                </p>
                <p className="text-xs font-medium text-muted-foreground">Avg Duration</p>
              </CardContent>
            </Card>
          </div>

          {/* Traffic chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Sessions ({period === "7d" ? "7 days" : "30 days"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.daily.length > 0 ? (
                <>
                  <div className="flex h-32 items-end gap-1">
                    {data.daily.map((day) => {
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
                          className="flex-1 rounded-t bg-foreground transition-all hover:bg-foreground/80"
                          style={{ height: `${height}%` }}
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
                    <span>Today</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No traffic data available</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* CTA / Custom Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  CTA &amp; Custom Events
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
                      No custom events tracked yet.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Set up CTA tracking in Google Tag Manager or add gtag events to the website:
                    </p>
                    <code className="block rounded bg-muted p-2 text-xs">
                      gtag(&apos;event&apos;, &apos;cta_click&apos;, &#123; button: &apos;call_now&apos; &#125;);
                    </code>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customEvents.map((event) => {
                      const maxCount = Math.max(...customEvents.map((e) => e.eventCount), 1);
                      const percent = Math.round((event.eventCount / maxCount) * 100);
                      return (
                        <div key={event.eventName}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{event.eventName}</span>
                            <span className="text-muted-foreground">
                              {formatNumber(event.eventCount)} ({event.users} users)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-foreground transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
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
                <CardTitle className="text-base">GA4 Auto Events</CardTitle>
              </CardHeader>
              <CardContent>
                {autoEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events tracked</p>
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
                <CardTitle className="text-base">Top Pages</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No page data available</p>
                ) : (
                  <div className="space-y-2">
                    {data.topPages.slice(0, 8).map((page, i) => (
                      <div
                        key={page.pagePath}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs">
                            {i + 1}
                          </span>
                          <span className="truncate text-sm" title={page.pagePath}>
                            {page.pagePath}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-medium">
                          {formatNumber(page.pageViews)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {data.trafficSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No source data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.trafficSources.map((source) => {
                      const maxSessions = Math.max(
                        ...data.trafficSources.map((s) => s.sessions),
                        1
                      );
                      const percent = Math.round((source.sessions / maxSessions) * 100);
                      return (
                        <div key={source.channel}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{source.channel}</span>
                            <span className="text-muted-foreground">
                              {formatNumber(source.sessions)} sessions
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-foreground transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
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
