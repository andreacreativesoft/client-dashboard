"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteCheck } from "@/types/database";

interface SeoItem {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string | null;
  details: string;
}

interface SeoAuditorProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "default" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}/100</Badge>;
}

function StatusIcon({ status }: { status: "pass" | "fail" | "warning" }) {
  if (status === "pass") {
    return <span className="text-success">&#10003;</span>;
  }
  if (status === "fail") {
    return <span className="text-destructive">&#10007;</span>;
  }
  return <span className="text-warning">&#9888;</span>;
}

export function SeoAuditor({
  websiteId,
  websiteName,
  websiteUrl,
  lastCheck,
  compact = false,
}: SeoAuditorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    summary: { passed: number; warnings: number; failed: number; totalChecks: number };
    results: SeoItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Audit failed");
      } else {
        setResult({ score: data.score, summary: data.summary, results: data.results });
      }
    } catch {
      setError("Network error — could not run audit");
    } finally {
      setLoading(false);
    }
  }

  const displayResult = result;
  const displayScore = displayResult?.score ?? (lastCheck?.score || null);
  const displaySummary = displayResult?.summary || (lastCheck?.summary as { passed?: number; warnings?: number; failed?: number; totalChecks?: number } | undefined);
  const displayResults = displayResult?.results || (lastCheck?.results as unknown as SeoItem[] | undefined);

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">SEO Audit</p>
          {displayScore !== null ? (
            <p className="text-xs text-muted-foreground">
              Score: {displayScore}/100 — {displaySummary?.passed || 0} passed, {displaySummary?.failed || 0} failed
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Not checked yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displayScore !== null && <ScoreBadge score={displayScore} />}
          <Button size="sm" onClick={runCheck} disabled={loading}>
            {loading ? "Auditing..." : "Audit"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>SEO Audit</CardTitle>
          <p className="text-xs text-muted-foreground">{websiteName} — {websiteUrl}</p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? "Auditing..." : "Run SEO Audit"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {displayScore !== null && displaySummary && (
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-border">
              <span className="text-xl font-bold">{displayScore}</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="text-success">&#10003;</span> {displaySummary.passed} passed</p>
              <p><span className="text-warning">&#9888;</span> {displaySummary.warnings} warnings</p>
              <p><span className="text-destructive">&#10007;</span> {displaySummary.failed} failed</p>
            </div>
          </div>
        )}

        {displayResults && displayResults.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide details" : "Show full audit"}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5">
                {displayResults.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded border border-border p-2"
                  >
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={item.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.details}</p>
                      {item.value && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground italic">
                          {item.value}
                        </p>
                      )}
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
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!displayResults && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run SEO Audit&quot; to check page titles, descriptions, headings, and more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
