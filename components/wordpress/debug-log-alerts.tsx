"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WPDebugLogSummary } from "@/types/database";

interface DebugLogAlertsProps {
  summaries: WPDebugLogSummary[];
}

export function DebugLogAlerts({ summaries }: DebugLogAlertsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summaries.length === 0) return null;

  // Calculate totals across all sites
  const totals = summaries.reduce(
    (acc, s) => ({
      fatal: acc.fatal + s.fatal,
      errors: acc.errors + s.errors,
      warnings: acc.warnings + s.warnings,
      notices: acc.notices + s.notices,
      deprecated: acc.deprecated + s.deprecated,
    }),
    { fatal: 0, errors: 0, warnings: 0, notices: 0, deprecated: 0 }
  );

  const hasCritical = totals.fatal > 0 || totals.errors > 0;

  return (
    <Card className={hasCritical ? "border-destructive" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg
              className={`h-5 w-5 ${hasCritical ? "text-destructive" : "text-muted-foreground"}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            WordPress Debug Logs
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {totals.fatal > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totals.fatal} Fatal
              </Badge>
            )}
            {totals.errors > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totals.errors} Error{totals.errors !== 1 ? "s" : ""}
              </Badge>
            )}
            {totals.warnings > 0 && (
              <Badge className="bg-yellow-600 text-xs text-white hover:bg-yellow-700">
                {totals.warnings} Warning{totals.warnings !== 1 ? "s" : ""}
              </Badge>
            )}
            {totals.notices > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totals.notices} Notice{totals.notices !== 1 ? "s" : ""}
              </Badge>
            )}
            {totals.deprecated > 0 && (
              <Badge variant="outline" className="text-xs">
                {totals.deprecated} Deprecated
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {summaries.map((summary) => {
            const isExpanded = expanded === summary.website_id;
            const siteHasCritical = summary.fatal > 0 || summary.errors > 0;

            return (
              <div
                key={summary.website_id}
                className={`rounded-lg border p-3 ${siteHasCritical ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
              >
                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : summary.website_id)
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {summary.website_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {summary.client_name}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {summary.site_url}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-1.5">
                    {summary.fatal > 0 && (
                      <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {summary.fatal} fatal
                      </span>
                    )}
                    {summary.errors > 0 && (
                      <span className="rounded bg-destructive/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {summary.errors} err
                      </span>
                    )}
                    {summary.warnings > 0 && (
                      <span className="rounded bg-yellow-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {summary.warnings} warn
                      </span>
                    )}
                    {summary.notices > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        {summary.notices} notice
                      </span>
                    )}
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {/* Recent log entries */}
                    <div className="max-h-64 overflow-y-auto rounded bg-background">
                      {summary.entries.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">
                          No log entries found.
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {summary.entries
                            .slice()
                            .reverse()
                            .slice(0, 20)
                            .map((entry, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-1.5 font-mono text-[11px] leading-relaxed"
                              >
                                <span
                                  className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                                    entry.level === "fatal"
                                      ? "bg-destructive text-white"
                                      : entry.level === "error"
                                        ? "bg-destructive/80 text-white"
                                        : entry.level === "warning"
                                          ? "bg-yellow-600 text-white"
                                          : entry.level === "notice"
                                            ? "bg-blue-600 text-white"
                                            : entry.level === "deprecated"
                                              ? "bg-muted text-muted-foreground"
                                              : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {entry.level}
                                </span>
                                {entry.timestamp && (
                                  <span className="mr-1.5 text-muted-foreground">
                                    {entry.timestamp}
                                  </span>
                                )}
                                <span className="break-all text-foreground">
                                  {entry.message.length > 200
                                    ? entry.message.slice(0, 200) + "..."
                                    : entry.message}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Link
                        href={`/admin/websites/${summary.website_id}`}
                        className="text-xs font-medium hover:underline"
                      >
                        View full log &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
