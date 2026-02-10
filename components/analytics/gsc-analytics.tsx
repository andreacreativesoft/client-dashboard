"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { GSCAnalyticsData } from "@/lib/actions/analytics";

type Props = {
  clientsWithGSC: Array<{
    clientId: string;
    clientName: string;
    siteUrl: string | null;
  }>;
  isAdmin: boolean;
  initialClientId?: string;
};

export function GSCAnalytics({ clientsWithGSC, isAdmin, initialClientId }: Props) {
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId || clientsWithGSC[0]?.clientId || ""
  );
  const [period, setPeriod] = useState<"7d" | "30d">("30d");
  const [data, setData] = useState<GSCAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (isAdmin && !selectedClientId) return;
      setLoading(true);
      setError(null);

      try {
        const { fetchGSCAnalytics } = await import("@/lib/actions/analytics");
        const result = await fetchGSCAnalytics(
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
        setError(err instanceof Error ? err.message : "Failed to fetch Search Console data");
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

  // Only show empty state for admins with no GSC clients
  if (isAdmin && clientsWithGSC.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-lg font-medium">No Google Search Console Integrations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Google Search Console in a client&apos;s settings to see organic search data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Google Search Console</h2>
          {data && (
            <Badge variant="outline" className="text-xs">
              {data.siteUrl}
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
          {isAdmin && clientsWithGSC.length > 1 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {clientsWithGSC.map((c) => (
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
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Data display */}
      {data && (
        <>
          {/* Overview metrics */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalClicks)}</p>
                <p className="text-xs font-medium text-muted-foreground">Total Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalImpressions)}</p>
                <p className="text-xs font-medium text-muted-foreground">Total Impressions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {(data.overview.averageCTR * 100).toFixed(1)}%
                </p>
                <p className="text-xs font-medium text-muted-foreground">Average CTR</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {data.overview.averagePosition.toFixed(1)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Avg Position</p>
              </CardContent>
            </Card>
          </div>

          {/* Clicks chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Organic Clicks ({period === "7d" ? "7 days" : "30 days"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.daily.length > 0 ? (
                <>
                  <div className="flex h-32 items-end gap-1">
                    {data.daily.map((day) => {
                      const maxClicks = Math.max(...data.daily.map((d) => d.clicks), 1);
                      const height = day.clicks > 0
                        ? Math.max((day.clicks / maxClicks) * 100, 4)
                        : 2;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 rounded-t bg-foreground transition-all hover:bg-foreground/80"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.clicks} clicks, ${formatNumber(day.impressions)} impressions, ${(day.ctr * 100).toFixed(1)}% CTR, pos ${day.position.toFixed(1)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{data.daily[0]?.date || ""}</span>
                    <span>{data.daily[data.daily.length - 1]?.date || ""}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No search data available</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Queries / Keywords */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top Keywords
                  {data.topQueries.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({data.topQueries.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.topQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No keyword data available</p>
                ) : (
                  <div className="space-y-2">
                    {data.topQueries.slice(0, 10).map((query, i) => (
                      <div
                        key={query.query}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs">
                            {i + 1}
                          </span>
                          <span className="truncate text-sm" title={query.query}>
                            {query.query}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs">
                          <span className="font-medium">{formatNumber(query.clicks)}</span>
                          <span className="text-muted-foreground" title="Position">
                            #{query.position.toFixed(1)}
                          </span>
                        </div>
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
                    {data.topPages.slice(0, 8).map((page, i) => {
                      // Show just the path portion
                      let displayPath = page.page;
                      try {
                        displayPath = new URL(page.page).pathname;
                      } catch {
                        // Keep original
                      }
                      return (
                        <div
                          key={page.page}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs">
                              {i + 1}
                            </span>
                            <span className="truncate text-sm" title={page.page}>
                              {displayPath}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs">
                            <span className="font-medium">{formatNumber(page.clicks)}</span>
                            <span className="text-muted-foreground" title="Impressions">
                              {formatNumber(page.impressions)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {data.deviceBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No device data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.deviceBreakdown.map((device) => {
                      const totalClicks = Math.max(
                        data.deviceBreakdown.reduce((sum, d) => sum + d.clicks, 0),
                        1
                      );
                      const percent = Math.round((device.clicks / totalClicks) * 100);
                      const deviceLabel = device.device.charAt(0).toUpperCase() + device.device.slice(1).toLowerCase();
                      return (
                        <div key={device.device}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{deviceLabel}</span>
                            <span className="text-muted-foreground">
                              {formatNumber(device.clicks)} clicks ({percent}%)
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

            {/* Query Performance (detailed) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Keyword Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No keyword data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topQueries.slice(0, 8).map((query) => {
                      const maxClicks = Math.max(...data.topQueries.map((q) => q.clicks), 1);
                      const percent = Math.round((query.clicks / maxClicks) * 100);
                      return (
                        <div key={query.query}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="truncate font-medium" title={query.query}>
                              {query.query}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {(query.ctr * 100).toFixed(1)}% CTR
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
