"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteCheck } from "@/types/database";

interface BrokenLinksResult {
  url: string;
  statusCode: number | null;
  error: string | null;
  isInternal: boolean;
}

interface BrokenLinksCheckerProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

export function BrokenLinksChecker({
  websiteId,
  websiteName,
  websiteUrl,
  lastCheck,
  compact = false,
}: BrokenLinksCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: { totalLinks: number; brokenCount: number };
    results: BrokenLinksResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/broken-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Check failed");
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
  const displaySummary = displayResult?.summary || (lastCheck?.summary as { totalLinks?: number; brokenCount?: number } | undefined);
  const displayResults = displayResult?.results || (lastCheck?.results as unknown as BrokenLinksResult[] | undefined);
  const brokenLinks = displayResults?.filter((r) => r.statusCode === null || (r.statusCode && r.statusCode >= 400)) || [];

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Broken Links</p>
          {displaySummary ? (
            <p className="text-xs text-muted-foreground">
              {displaySummary.brokenCount === 0 ? "All links OK" : `${displaySummary.brokenCount} broken of ${displaySummary.totalLinks}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Not checked yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displaySummary && (
            <Badge variant={displaySummary.brokenCount === 0 ? "default" : "destructive"}>
              {displaySummary.brokenCount === 0 ? "OK" : `${displaySummary.brokenCount} broken`}
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
          <CardTitle>Broken Links</CardTitle>
          <p className="text-xs text-muted-foreground">{websiteName} — {websiteUrl}</p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? "Checking..." : "Check Links"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {displaySummary && (
          <div className="mb-3 flex items-center gap-3">
            <Badge variant={displaySummary.brokenCount === 0 ? "default" : "destructive"}>
              {displaySummary.brokenCount === 0 ? "All Links OK" : `${displaySummary.brokenCount} Broken Links`}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {displaySummary.totalLinks} links checked
            </span>
          </div>
        )}

        {brokenLinks.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide details" : "Show broken links"}
            </button>
            {expanded && (
              <div className="mt-2 overflow-x-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">URL</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Type</th>
                      <th className="p-2 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokenLinks.map((link, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="max-w-xs truncate p-2">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {link.url}
                          </a>
                        </td>
                        <td className="p-2">
                          <Badge variant="destructive">
                            {link.statusCode || link.error || "Failed"}
                          </Badge>
                        </td>
                        <td className="p-2">{link.isInternal ? "Internal" : "External"}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={runCheck}
                            disabled={loading}
                            className="h-6 px-2 text-[10px]"
                          >
                            {loading ? "..." : "Retest"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!displaySummary && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Check Links&quot; to scan for broken links on this website.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
