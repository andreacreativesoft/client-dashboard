"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteCheck } from "@/types/database";

interface UptimeResult {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string;
  details: string;
}

interface UptimeCheckerProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

export function UptimeChecker({
  websiteId,
  websiteName,
  websiteUrl,
  lastCheck,
  compact = false,
}: UptimeCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: { isUp: boolean; statusCode: number; responseTime: number; pageSize: number; passed: number; warnings: number; failed: number };
    results: UptimeResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/uptime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Check failed");
        if (data.summary) {
          setResult({ summary: data.summary, results: [] });
        }
      } else {
        setResult({ summary: data.summary, results: data.results });
      }
    } catch {
      setError("Network error — could not run check");
    } finally {
      setLoading(false);
    }
  }

  const displayResult = result;
  const displaySummary = displayResult?.summary || (lastCheck?.summary as {
    isUp?: boolean;
    statusCode?: number;
    responseTime?: number;
    pageSize?: number;
    passed?: number;
    warnings?: number;
    failed?: number;
  } | undefined);
  const displayResults = displayResult?.results || (lastCheck?.results as unknown as UptimeResult[] | undefined);

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Uptime & Performance</p>
          {displaySummary ? (
            <p className="text-xs text-muted-foreground">
              {displaySummary.isUp ? "UP" : "DOWN"} — {displaySummary.responseTime}ms — {displaySummary.pageSize} KB
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Not checked yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displaySummary && (
            <Badge variant={displaySummary.isUp ? "default" : "destructive"}>
              {displaySummary.isUp ? "UP" : "DOWN"}
            </Badge>
          )}
          <Button size="sm" onClick={runCheck} disabled={loading}>
            {loading ? "Checking..." : "Check"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Uptime & Performance</CardTitle>
          <p className="text-xs text-muted-foreground">{websiteName} — {websiteUrl}</p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? "Checking..." : "Check Status"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {displaySummary && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded border border-border p-3 text-center">
              <Badge variant={displaySummary.isUp ? "default" : "destructive"} className="mb-1">
                {displaySummary.isUp ? "UP" : "DOWN"}
              </Badge>
              <p className="text-xs text-muted-foreground">Status</p>
            </div>
            <div className="rounded border border-border p-3 text-center">
              <p className="text-lg font-bold">{displaySummary.responseTime}<span className="text-xs font-normal">ms</span></p>
              <p className="text-xs text-muted-foreground">Response</p>
            </div>
            <div className="rounded border border-border p-3 text-center">
              <p className="text-lg font-bold">{displaySummary.statusCode}</p>
              <p className="text-xs text-muted-foreground">HTTP Code</p>
            </div>
            <div className="rounded border border-border p-3 text-center">
              <p className="text-lg font-bold">{displaySummary.pageSize}<span className="text-xs font-normal">KB</span></p>
              <p className="text-xs text-muted-foreground">Page Size</p>
            </div>
          </div>
        )}

        {displayResults && displayResults.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide details" : "Show all checks"}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5">
                {displayResults.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border border-border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.details}</p>
                    </div>
                    <Badge
                      variant={
                        item.status === "pass"
                          ? "default"
                          : item.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      className="shrink-0"
                    >
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!displayResults && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Check Status&quot; to test uptime, response time, SSL, and performance.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
