"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { GBPAnalyticsData } from "@/lib/actions/analytics";

type Props = {
  clientsWithGBP: Array<{
    clientId: string;
    clientName: string;
    locationName: string | null;
  }>;
  isAdmin: boolean;
  initialClientId?: string;
};

export function GBPAnalytics({ clientsWithGBP, isAdmin, initialClientId }: Props) {
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId || clientsWithGBP[0]?.clientId || ""
  );
  const [period, setPeriod] = useState<"7d" | "30d">("30d");
  const [data, setData] = useState<GBPAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!selectedClientId) return;
      setLoading(true);
      setError(null);

      try {
        const { fetchGBPAnalytics } = await import("@/lib/actions/analytics");
        const result = await fetchGBPAnalytics(selectedClientId, period, forceRefresh);

        if (result.success && result.data) {
          setData(result.data);
          setCached(!!result.cached);
        } else {
          setError(result.error || "Failed to fetch data");
          setData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch GBP data");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [selectedClientId, period]
  );

  useEffect(() => {
    if (selectedClientId) {
      fetchData();
    }
  }, [selectedClientId, period, fetchData]);

  if (clientsWithGBP.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-lg font-medium">No Google Business Profile</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Google Business Profile in a client&apos;s settings to see direction requests, calls, and website clicks.
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
          <h2 className="text-lg font-semibold">Google Business Profile</h2>
          {data && (
            <Badge variant="outline" className="text-xs">
              {data.locationName}
            </Badge>
          )}
          {cached && (
            <Badge variant="secondary" className="text-xs">
              Cached
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && clientsWithGBP.length > 1 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {clientsWithGBP.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName}
                </option>
              ))}
            </select>
          )}

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

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Data */}
      {data && (
        <>
          {/* Interaction totals */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.directionRequests)}</p>
                <p className="text-xs font-medium text-muted-foreground">Direction Requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.callClicks)}</p>
                <p className="text-xs font-medium text-muted-foreground">Call Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.websiteClicks)}</p>
                <p className="text-xs font-medium text-muted-foreground">Website Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.totalInteractions)}</p>
                <p className="text-xs font-medium text-muted-foreground">Total Interactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Impressions */}
          <div className="grid gap-3 grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.totalImpressions)}</p>
                <p className="text-xs font-medium text-muted-foreground">Total Impressions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.impressionsSearch)}</p>
                <p className="text-xs font-medium text-muted-foreground">Search Impressions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatNumber(data.totals.impressionsMaps)}</p>
                <p className="text-xs font-medium text-muted-foreground">Maps Impressions</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily interactions chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Daily Interactions ({period === "7d" ? "7 days" : "30 days"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.daily.length > 0 ? (
                <>
                  <div className="flex h-32 items-end gap-1">
                    {data.daily.map((day) => {
                      const totalDay = day.directionRequests + day.callClicks + day.websiteClicks;
                      const maxTotal = Math.max(
                        ...data.daily.map((d) => d.directionRequests + d.callClicks + d.websiteClicks),
                        1
                      );
                      const height = totalDay > 0
                        ? Math.max((totalDay / maxTotal) * 100, 4)
                        : 2;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 rounded-t bg-foreground transition-all hover:bg-foreground/80"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.directionRequests} directions, ${day.callClicks} calls, ${day.websiteClicks} website`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{data.daily[0]?.date.slice(5) || ""}</span>
                    <span>{data.daily[data.daily.length - 1]?.date.slice(5) || ""}</span>
                  </div>

                  {/* Legend */}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Hover bars for breakdown</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No interaction data available</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Interaction breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interaction Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Direction Requests", count: data.totals.directionRequests, icon: "📍" },
                    { label: "Call Clicks", count: data.totals.callClicks, icon: "📞" },
                    { label: "Website Clicks", count: data.totals.websiteClicks, icon: "🌐" },
                  ].map((item) => {
                    const percent = data.totals.totalInteractions > 0
                      ? Math.round((item.count / data.totals.totalInteractions) * 100)
                      : 0;
                    return (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{item.icon} {item.label}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(item.count)} ({percent}%)
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
              </CardContent>
            </Card>

            {/* Search Keywords */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Search Keywords
                  {data.searchKeywords.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (monthly)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.searchKeywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No search keyword data available. Keywords may take time to appear.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.searchKeywords.slice(0, 10).map((kw, i) => (
                      <div
                        key={kw.keyword}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs">
                            {i + 1}
                          </span>
                          <span className="truncate text-sm">{kw.keyword}</span>
                        </div>
                        <span className="shrink-0 text-sm font-medium">
                          {formatNumber(kw.impressions)}
                        </span>
                      </div>
                    ))}
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
