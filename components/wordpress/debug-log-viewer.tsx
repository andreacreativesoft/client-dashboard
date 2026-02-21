"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDebugLogAction, toggleDebugModeAction } from "@/lib/actions/wordpress-manage";
import type { DebugLogEntry } from "@/types/wordpress";

// ─── Types ──────────────────────────────────────────────────────────────

interface DebugLogViewerProps {
  websiteId: string;
}

type Severity = DebugLogEntry["severity"];
type FilterLevel = Severity | "all";

interface AIAnalysis {
  summary: string;
  severity: "critical" | "warning" | "healthy";
  issues: {
    title: string;
    description: string;
    fix: string;
    priority: "critical" | "high" | "medium" | "low";
    count: number;
  }[];
  patterns: string[];
  recommendations: string[];
  tokens_used?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<Severity, string> = {
  fatal: "bg-destructive text-white",
  warning: "bg-yellow-600 text-white",
  notice: "bg-blue-600 text-white",
  deprecated: "bg-muted text-muted-foreground",
  parse: "bg-destructive/80 text-white",
  unknown: "bg-muted text-muted-foreground",
};

const LEVEL_LABELS: Record<Severity, string> = {
  fatal: "Fatal",
  warning: "Warning",
  notice: "Notice",
  deprecated: "Deprecated",
  parse: "Parse",
  unknown: "Other",
};

const AUTO_REFRESH_INTERVALS = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

// ─── Component ──────────────────────────────────────────────────────────

export function DebugLogViewer({ websiteId }: DebugLogViewerProps) {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterLevel>("all");
  const [search, setSearch] = useState("");
  const [fileSize, setFileSize] = useState<string | undefined>();
  const [lastModified, setLastModified] = useState<string | undefined>();
  const [truncated, setTruncated] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);

  // Debug mode toggle
  const [togglingDebug, setTogglingDebug] = useState(false);

  // ─── Fetch debug log ───────────────────────────────────────────────

  const fetchLog = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await getDebugLogAction(websiteId, 500);

      if (!result.success) {
        setError(result.error || "Failed to fetch debug log");
        return;
      }

      if (result.data) {
        setEntries(result.data.entries || []);
        setFileSize(result.data.file_size);
        setLastModified(result.data.last_modified);
        setTruncated(result.data.truncated);
      }
      setLoaded(true);
    });
  }, [websiteId]);

  // ─── Auto-refresh ─────────────────────────────────────────────────

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh > 0 && loaded) {
      intervalRef.current = setInterval(fetchLog, autoRefresh * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loaded, fetchLog]);

  // ─── AI Analysis ──────────────────────────────────────────────────

  async function handleAiAnalysis() {
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch(`/api/wordpress/${websiteId}/debug-log/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data: AIAnalysis = await res.json();
      setAiAnalysis(data);
      setShowAi(true);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Toggle debug mode ────────────────────────────────────────────

  async function handleToggleDebug(enable: boolean) {
    if (!confirm(`${enable ? "Enable" : "Disable"} WP_DEBUG on this site?`)) return;
    setTogglingDebug(true);

    startTransition(async () => {
      const result = await toggleDebugModeAction(websiteId, enable);
      setTogglingDebug(false);

      if (result.success) {
        fetchLog(); // Refresh to see new state
      } else {
        setError(result.error || "Failed to toggle debug mode");
      }
    });
  }

  // ─── Filter & search ─────────────────────────────────────────────

  const filteredEntries = entries.filter((e) => {
    if (filter !== "all" && e.severity !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.message.toLowerCase().includes(q) ||
        (e.file && e.file.toLowerCase().includes(q)) ||
        e.raw.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Count by severity
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.severity] = (acc[e.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <svg
                className="h-5 w-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              Debug Log
            </CardTitle>
            <div className="flex items-center gap-2">
              {loaded && (
                <>
                  {/* Auto-refresh selector */}
                  <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                    <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    <select
                      value={autoRefresh}
                      onChange={(e) => setAutoRefresh(Number(e.target.value))}
                      className="border-0 bg-transparent text-xs outline-none"
                    >
                      {AUTO_REFRESH_INTERVALS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AI Analysis button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAiAnalysis}
                    disabled={aiLoading || entries.length === 0}
                    className="h-8 text-xs"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                        </svg>
                        AI Analysis
                      </>
                    )}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={fetchLog}
                disabled={isPending}
                className="h-8 text-xs"
              >
                {isPending ? "Loading..." : loaded ? "Refresh" : "Fetch Debug Log"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {error && (
            <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
              {error.includes("mu-plugin") && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Make sure the dashboard-connector.php mu-plugin is installed on the WordPress site.
                </p>
              )}
            </div>
          )}

          {!loaded && !error && !isPending && (
            <p className="text-sm text-muted-foreground">
              Click &quot;Fetch Debug Log&quot; to read the WordPress debug.log file remotely.
              Requires the dashboard-connector mu-plugin on the WordPress site.
            </p>
          )}

          {loaded && (
            <>
              {/* Status bar */}
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {fileSize && <span>Size: {fileSize}</span>}
                {lastModified && (
                  <span>Modified: {new Date(lastModified).toLocaleString()}</span>
                )}
                {truncated && (
                  <Badge variant="secondary" className="text-[10px]">
                    Truncated
                  </Badge>
                )}
                {autoRefresh > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    Auto-refresh: {autoRefresh}s
                  </Badge>
                )}
                <span className="text-muted-foreground/50">|</span>
                <button
                  onClick={() => handleToggleDebug(true)}
                  disabled={isPending || togglingDebug}
                  className="text-xs hover:underline"
                >
                  Enable Debug
                </button>
                <button
                  onClick={() => handleToggleDebug(false)}
                  disabled={isPending || togglingDebug}
                  className="text-xs hover:underline"
                >
                  Disable Debug
                </button>
              </div>

              {/* Search + filter bar */}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <Input
                    placeholder="Search log entries..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                {/* Severity filter pills */}
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilter("all")}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      filter === "all"
                        ? "bg-foreground text-background"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    All ({entries.length})
                  </button>
                  {(
                    ["fatal", "parse", "warning", "notice", "deprecated", "unknown"] as Severity[]
                  ).map((level) =>
                    counts[level] ? (
                      <button
                        key={level}
                        onClick={() => setFilter(level)}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          filter === level
                            ? LEVEL_STYLES[level]
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {LEVEL_LABELS[level]} ({counts[level]})
                      </button>
                    ) : null
                  )}
                </div>
              </div>

              {/* Log entries */}
              {filteredEntries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {entries.length === 0
                    ? "Debug log is empty or does not exist."
                    : "No entries match the current filter/search."}
                </p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border bg-background">
                  <div className="divide-y divide-border">
                    {filteredEntries
                      .slice()
                      .reverse()
                      .map((entry, idx) => (
                        <LogEntry
                          key={idx}
                          entry={entry}
                          search={search}
                        />
                      ))}
                  </div>
                </div>
              )}

              {filteredEntries.length > 0 && (
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Showing {filteredEntries.length} of {entries.length} entries
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Panel */}
      {aiError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">AI Analysis failed: {aiError}</p>
        </div>
      )}

      {showAi && aiAnalysis && (
        <AIAnalysisPanel
          analysis={aiAnalysis}
          onClose={() => setShowAi(false)}
        />
      )}
    </div>
  );
}

// ─── Log Entry Row ──────────────────────────────────────────────────────

function LogEntry({
  entry,
  search,
}: {
  entry: DebugLogEntry;
  search: string;
}) {
  const severity = entry.severity;
  const style = LEVEL_STYLES[severity] || LEVEL_STYLES.unknown;

  return (
    <div className="px-3 py-2 font-mono text-[11px] leading-relaxed hover:bg-muted/50">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 inline-block shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${style}`}
        >
          {severity}
        </span>
        <div className="min-w-0 flex-1">
          {entry.timestamp && (
            <span className="mr-2 text-muted-foreground">
              {entry.timestamp}
            </span>
          )}
          <span className="break-all text-foreground">
            {search ? highlightMatch(entry.message, search) : entry.message}
          </span>
          {entry.file && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {entry.file}
              {entry.line ? `:${entry.line}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Analysis Panel ──────────────────────────────────────────────────

function AIAnalysisPanel({
  analysis,
  onClose,
}: {
  analysis: AIAnalysis;
  onClose: () => void;
}) {
  const severityColor =
    analysis.severity === "critical"
      ? "border-destructive bg-destructive/5"
      : analysis.severity === "warning"
        ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
        : "border-green-500 bg-green-50 dark:bg-green-950/20";

  const severityBadge =
    analysis.severity === "critical"
      ? "bg-destructive text-white"
      : analysis.severity === "warning"
        ? "bg-yellow-600 text-white"
        : "bg-green-600 text-white";

  const priorityColors: Record<string, string> = {
    critical: "bg-destructive text-white",
    high: "bg-destructive/80 text-white",
    medium: "bg-yellow-600 text-white",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <Card className={severityColor}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI Debug Log Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${severityBadge}`}>
              {analysis.severity.charAt(0).toUpperCase() + analysis.severity.slice(1)}
            </Badge>
            {analysis.tokens_used && (
              <span className="text-[10px] text-muted-foreground">
                {analysis.tokens_used.toLocaleString()} tokens
              </span>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Summary */}
        <p className="text-sm">{analysis.summary}</p>

        {/* Issues */}
        {analysis.issues.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">
              Issues ({analysis.issues.length})
            </h4>
            <div className="space-y-2">
              {analysis.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            priorityColors[issue.priority] || priorityColors.low
                          }`}
                        >
                          {issue.priority}
                        </span>
                        <span className="text-sm font-medium">
                          {issue.title}
                        </span>
                        {issue.count > 1 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {issue.count}x
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {issue.description}
                      </p>
                      {issue.fix && (
                        <div className="mt-2 rounded bg-muted/50 p-2">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Fix:
                          </span>
                          <p className="mt-0.5 text-xs">{issue.fix}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patterns */}
        {analysis.patterns.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Patterns Detected</h4>
            <ul className="space-y-1">
              {analysis.patterns.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-muted-foreground">&#8226;</span>
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Recommendations</h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-green-600">&#10003;</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
