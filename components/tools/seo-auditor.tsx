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
  page?: string;
}

interface PageAudit {
  url: string;
  path: string;
  items: SeoItem[];
  score: number;
  passed: number;
  warnings: number;
  failed: number;
}

interface SeoAuditorProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

/** Convert legacy flat SeoItem[] (with page field) into PageAudit[] for the new UI */
function groupItemsIntoPages(items: SeoItem[], baseUrl?: string): { pages: PageAudit[]; siteWide: SeoItem[] } {
  const siteWide: SeoItem[] = [];
  const pageMap = new Map<string, SeoItem[]>();

  for (const item of items) {
    const pagePath = item.page || "/";
    if (pagePath === "site-wide") {
      siteWide.push(item);
    } else {
      // Normalize path to avoid duplicates (e.g. "/" and "/")
      const normalizedPath = pagePath.replace(/\/$/, "") || "/";
      const existing = pageMap.get(normalizedPath) || [];
      existing.push(item);
      pageMap.set(normalizedPath, existing);
    }
  }

  // Build full URL from path + baseUrl for re-audit support
  const normalizedBase = baseUrl?.replace(/\/$/, "") || "";

  const pages: PageAudit[] = [];
  for (const [path, pageItems] of pageMap) {
    // Deduplicate items by name within each page (keep last occurrence)
    const deduped = new Map<string, SeoItem>();
    for (const item of pageItems) {
      deduped.set(item.name, item);
    }
    const uniqueItems = Array.from(deduped.values());

    const passed = uniqueItems.filter(i => i.status === "pass").length;
    const warnings = uniqueItems.filter(i => i.status === "warning").length;
    const failed = uniqueItems.filter(i => i.status === "fail").length;
    const total = uniqueItems.length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    const fullUrl = normalizedBase ? `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}` : path;
    pages.push({ url: fullUrl, path, items: uniqueItems, score, passed, warnings, failed });
  }

  return { pages, siteWide };
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "default" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}/100</Badge>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
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

function PageDetail({ page, siteWide, websiteId, onBack, onPageUpdated }: {
  page: PageAudit;
  siteWide?: SeoItem[];
  websiteId: string;
  onBack: () => void;
  onPageUpdated: (updated: PageAudit) => void;
}) {
  const [reauditing, setReauditing] = useState(false);
  const [reauditError, setReauditError] = useState<string | null>(null);

  async function reauditPage() {
    setReauditing(true);
    setReauditError(null);
    try {
      const res = await fetch("/api/tools/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, pageUrl: page.url }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setReauditError(data.error || "Re-audit failed");
      } else {
        onPageUpdated(data.page as PageAudit);
      }
    } catch {
      setReauditError("Network error");
    } finally {
      setReauditing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to pages
        </Button>
        <Button size="sm" onClick={reauditPage} disabled={reauditing}>
          {reauditing ? "Checking..." : "Re-audit page"}
        </Button>
      </div>

      {reauditError && (
        <div className="rounded border border-destructive/20 bg-destructive/5 p-2">
          <p className="text-xs text-destructive">{reauditError}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border">
          <span className="text-base font-bold">{page.score}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{page.path}</p>
          <p className="text-xs text-muted-foreground">
            {page.passed} passed, {page.warnings} warnings, {page.failed} failed
          </p>
        </div>
      </div>

      {/* Site-wide checks shown on homepage detail */}
      {siteWide && siteWide.length > 0 && page.path === "/" && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Site-wide</p>
          {siteWide.map((item, i) => (
            <div key={i} className="flex items-start gap-2 rounded border border-border p-2">
              <div className="mt-0.5 shrink-0"><StatusIcon status={item.status} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.details}</p>
                {item.value && <p className="mt-0.5 truncate text-xs text-muted-foreground italic">{item.value}</p>}
              </div>
              <Badge variant={item.status === "pass" ? "default" : item.status === "warning" ? "warning" : "destructive"} className="shrink-0">{item.status}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Page checks</p>
        {page.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded border border-border p-2">
            <div className="mt-0.5 shrink-0"><StatusIcon status={item.status} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.details}</p>
              {item.value && <p className="mt-0.5 truncate text-xs text-muted-foreground italic">{item.value}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant={item.status === "pass" ? "default" : item.status === "warning" ? "warning" : "destructive"}>{item.status}</Badge>
              {item.status !== "pass" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reauditPage}
                  disabled={reauditing}
                  className="h-6 px-2 text-[10px]"
                  title="Re-audit this page to recheck"
                >
                  {reauditing ? "..." : "Retest"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
    summary: {
      passed: number;
      warnings: number;
      failed: number;
      totalChecks: number;
      pagesAudited?: number;
    };
    pages?: PageAudit[];
    siteWide?: SeoItem[];
    results: SeoItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageAudit | null>(null);
  const [pagesExpanded, setPagesExpanded] = useState(false);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedPage(null);

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
        setResult({
          score: data.score,
          summary: data.summary,
          pages: data.pages,
          siteWide: data.siteWide,
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
    pagesAudited?: number;
  } | undefined);

  // Convert legacy flat results into pages format if needed
  const legacyItems = !displayResult?.pages
    ? (displayResult?.results || (lastCheck?.results as unknown as SeoItem[] | undefined))
    : undefined;
  const legacyGrouped = legacyItems && legacyItems.length > 0
    ? groupItemsIntoPages(legacyItems, websiteUrl)
    : undefined;

  const displayPages = displayResult?.pages || legacyGrouped?.pages;
  const displaySiteWide = displayResult?.siteWide || legacyGrouped?.siteWide;

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">SEO Audit</p>
          {displayScore !== null ? (
            <p className="text-xs text-muted-foreground">
              Score: {displayScore}/100 — {displaySummary?.passed || 0} passed, {displaySummary?.failed || 0} failed
              {displaySummary?.pagesAudited ? ` — ${displaySummary.pagesAudited} pages` : ""}
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
              {displaySummary.pagesAudited && (
                <p className="text-muted-foreground">{displaySummary.pagesAudited} pages audited</p>
              )}
            </div>
          </div>
        )}

        {/* Per-page results — detail view for selected page */}
        {displayPages && displayPages.length > 0 && selectedPage && (
          <PageDetail
            page={selectedPage}
            siteWide={displaySiteWide}
            websiteId={websiteId}
            onBack={() => setSelectedPage(null)}
            onPageUpdated={(updated) => {
              setSelectedPage(updated);
              // Also update the page in the pages list so going back shows fresh data
              if (result?.pages) {
                setResult({
                  ...result,
                  pages: result.pages.map((p) =>
                    p.url === updated.url ? updated : p
                  ),
                });
              }
            }}
          />
        )}

        {/* Per-page results — collapsible pages list */}
        {displayPages && displayPages.length > 0 && !selectedPage && (
          <div>
            <button
              onClick={() => setPagesExpanded(!pagesExpanded)}
              className="flex w-full items-center gap-2 py-2 text-left"
            >
              <svg
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${pagesExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                {displayPages.length} pages audited — {pagesExpanded ? "click to collapse" : "click to view details"}
              </span>
            </button>

            {pagesExpanded && (
              <div className="mt-1.5 space-y-1.5">
                {displayPages.map((page) => (
                  <button
                    key={page.url}
                    onClick={() => setSelectedPage(page)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{page.path}</p>
                      <div className="mt-1.5">
                        <ScoreBar score={page.score} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {page.failed > 0 && <span className="text-destructive">{page.failed} fail</span>}
                        {page.warnings > 0 && <span className="text-warning">{page.warnings} warn</span>}
                      </div>
                      <ScoreBadge score={page.score} />
                      <svg className="h-3 w-3 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!displayPages && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run SEO Audit&quot; to check all pages — titles, descriptions, headings, images, and more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
