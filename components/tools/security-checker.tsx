"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteCheck } from "@/types/database";

interface SecurityResult {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string;
  details: string;
  category: "headers" | "wordpress" | "server" | "access";
}

interface SecurityCheckerProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  headers: "Security Headers",
  wordpress: "WordPress Security",
  server: "Server Configuration",
  access: "File Access",
};

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "default" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}/100</Badge>;
}

export function SecurityChecker({
  websiteId,
  websiteName,
  websiteUrl,
  lastCheck,
  compact = false,
}: SecurityCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    summary: { passed: number; warnings: number; failed: number; totalChecks: number };
    results: SecurityResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Security audit failed");
      } else {
        setResult({
          score: data.score,
          summary: data.summary,
          results: data.results,
        });
      }
    } catch {
      setError("Network error — could not run audit");
    } finally {
      setLoading(false);
    }
  }

  const displayResult = result;
  const displayScore = displayResult?.score ?? (lastCheck?.score || null);
  const displaySummary = displayResult?.summary || (lastCheck?.summary as {
    passed?: number;
    warnings?: number;
    failed?: number;
    totalChecks?: number;
  } | undefined);
  const displayResults = displayResult?.results || (lastCheck?.results as unknown as SecurityResult[] | undefined);

  const filteredResults = displayResults
    ? activeCategory === "all"
      ? displayResults
      : displayResults.filter((r) => r.category === activeCategory)
    : undefined;

  // Count by category
  const categoryCounts = displayResults?.reduce((acc, r) => {
    if (r.status !== "pass") {
      acc[r.category] = (acc[r.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Security Audit</p>
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
          <CardTitle>Security Audit</CardTitle>
          <p className="text-xs text-muted-foreground">{websiteName} — {websiteUrl}</p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? "Scanning..." : "Run Security Audit"}
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
            <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${
              displayScore >= 80
                ? "border-green-500"
                : displayScore >= 50
                  ? "border-yellow-500"
                  : "border-red-500"
            }`}>
              <span className="text-xl font-bold">{displayScore}</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="text-success">&#10003;</span> {displaySummary.passed} passed</p>
              <p><span className="text-warning">&#9888;</span> {displaySummary.warnings} warnings</p>
              <p><span className="text-destructive">&#10007;</span> {displaySummary.failed} critical</p>
            </div>
          </div>
        )}

        {displayResults && displayResults.length > 0 && (
          <div className="space-y-3">
            {/* Category filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveCategory("all")}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeCategory === "all" ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
                }`}
              >
                All ({displayResults.length})
              </button>
              {(["headers", "wordpress", "server", "access"] as const).map((cat) => {
                const count = displayResults.filter((r) => r.category === cat).length;
                const issues = categoryCounts?.[cat] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      activeCategory === cat ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]} {issues > 0 && <span className="text-destructive">({issues})</span>}
                  </button>
                );
              })}
            </div>

            {/* Toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Collapse details" : "Show details"}
            </button>

            {/* Results list */}
            <div className="space-y-1.5">
              {(expanded ? filteredResults : filteredResults?.filter((r) => r.status !== "pass"))?.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">{item.name}</p>
                      <span className="text-[9px] text-muted-foreground uppercase">{item.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.details}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant={
                        item.status === "pass"
                          ? "default"
                          : item.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {item.value}
                    </Badge>
                    {item.status !== "pass" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={runCheck}
                        disabled={loading}
                        className="h-6 px-2 text-[10px]"
                        title="Re-run security audit"
                      >
                        {loading ? "..." : "Retest"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!expanded && filteredResults?.every((r) => r.status === "pass") && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  All checks passed. Click &quot;Show details&quot; to see all results.
                </p>
              )}
            </div>
          </div>
        )}

        {!displayResults && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run Security Audit&quot; to check security headers, WordPress hardening, exposed files, and more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
