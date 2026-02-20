"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDebugLogForWebsite } from "@/lib/actions/wordpress-remote";
import type { WPDebugLogEntry, WPDebugLogLevel } from "@/types/database";

interface DebugLogViewerProps {
  websiteId: string;
}

const LEVEL_STYLES: Record<WPDebugLogLevel, string> = {
  fatal: "bg-destructive text-white",
  error: "bg-destructive/80 text-white",
  warning: "bg-yellow-600 text-white",
  notice: "bg-blue-600 text-white",
  deprecated: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
};

const LEVEL_LABELS: Record<WPDebugLogLevel, string> = {
  fatal: "Fatal",
  error: "Error",
  warning: "Warning",
  notice: "Notice",
  deprecated: "Deprecated",
  info: "Info",
};

type FilterLevel = WPDebugLogLevel | "all";

export function DebugLogViewer({ websiteId }: DebugLogViewerProps) {
  const [entries, setEntries] = useState<WPDebugLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterLevel>("all");
  const [debugEnabled, setDebugEnabled] = useState<boolean | undefined>();
  const [logEnabled, setLogEnabled] = useState<boolean | undefined>();
  const [fileSize, setFileSize] = useState<number | undefined>();
  const [lastModified, setLastModified] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    startTransition(async () => {
      setError(null);
      const result = await getDebugLogForWebsite(websiteId);

      if (!result.success) {
        setError(result.error || "Failed to fetch debug log");
        return;
      }

      setEntries(result.entries || []);
      setDebugEnabled(result.debugEnabled);
      setLogEnabled(result.logEnabled);
      setFileSize(result.fileSize);
      setLastModified(result.lastModified);
      setLoaded(true);
    });
  }

  const filteredEntries =
    filter === "all" ? entries : entries.filter((e) => e.level === filter);

  // Count by level
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.level] = (acc[e.level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function formatBytes(bytes: number): string {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
          <Button
            size="sm"
            variant="outline"
            onClick={handleFetch}
            disabled={isPending}
            className="h-8 text-xs"
          >
            {isPending ? "Loading..." : loaded ? "Refresh" : "Fetch Debug Log"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
            {error.includes("No WordPress integration") && (
              <p className="mt-1 text-xs text-muted-foreground">
                Connect WordPress in the client detail page first (Integrations section).
              </p>
            )}
            {error.includes("Connection failed") && (
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
              <Badge
                variant={debugEnabled ? "default" : "secondary"}
                className="text-[10px]"
              >
                WP_DEBUG: {debugEnabled ? "ON" : "OFF"}
              </Badge>
              <Badge
                variant={logEnabled ? "default" : "secondary"}
                className="text-[10px]"
              >
                WP_DEBUG_LOG: {logEnabled ? "ON" : "OFF"}
              </Badge>
              {fileSize !== undefined && (
                <span>File size: {formatBytes(fileSize)}</span>
              )}
              {lastModified && (
                <span>
                  Last modified: {new Date(lastModified).toLocaleString()}
                </span>
              )}
            </div>

            {/* Summary badges */}
            {entries.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${filter === "all" ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"}`}
                >
                  All ({entries.length})
                </button>
                {(
                  [
                    "fatal",
                    "error",
                    "warning",
                    "notice",
                    "deprecated",
                    "info",
                  ] as WPDebugLogLevel[]
                ).map(
                  (level) =>
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
            )}

            {/* Log entries */}
            {filteredEntries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {entries.length === 0
                  ? "Debug log is empty or does not exist."
                  : "No entries match the selected filter."}
              </p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border bg-background">
                <div className="divide-y divide-border">
                  {filteredEntries
                    .slice()
                    .reverse()
                    .map((entry, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 font-mono text-[11px] leading-relaxed hover:bg-muted/50"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 inline-block shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${LEVEL_STYLES[entry.level]}`}
                          >
                            {entry.level}
                          </span>
                          <div className="min-w-0 flex-1">
                            {entry.timestamp && (
                              <span className="mr-2 text-muted-foreground">
                                {entry.timestamp}
                              </span>
                            )}
                            <span className="break-all text-foreground">
                              {entry.message}
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
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
