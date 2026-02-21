"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerInfoCard } from "./server-info-card";
import { ThemeInfoCard } from "./theme-info-card";
import { DiskUsageCard } from "./disk-usage-card";
import { PluginList } from "./plugin-list";
import type { SiteHealthData, PluginInfo } from "@/types/wordpress";

interface SiteHealthDashboardProps {
  websiteId: string;
}

interface HealthData {
  health: SiteHealthData;
  plugins: PluginInfo[];
}

export function SiteHealthDashboard({ websiteId }: SiteHealthDashboardProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/wordpress/${websiteId}/site-health`);

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const result: HealthData = await res.json();
        setData(result);
        setLastChecked(new Date());
        setLoaded(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Site Health</h3>
          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleFetch}
          disabled={isPending}
          className="h-8 text-xs"
        >
          {isPending ? (
            <>
              <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking...
            </>
          ) : loaded ? (
            "Refresh"
          ) : (
            "Check Site Health"
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
          {error.includes("mu-plugin") && (
            <div className="mt-1.5 flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                The dashboard-connector mu-plugin must be installed on the WordPress site.
              </p>
              <a
                href="/mu-plugins/dashboard-connector.php"
                download="dashboard-connector.php"
                className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Plugin
              </a>
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!loaded && !error && !isPending && (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <svg className="mx-auto h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">
            Click &quot;Check Site Health&quot; to fetch WordPress version info, plugin list, disk usage, and more.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="text-xs text-muted-foreground/70">
              Requires the dashboard-connector mu-plugin.
            </p>
            <a
              href="/mu-plugins/dashboard-connector.php"
              download="dashboard-connector.php"
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isPending && !loaded && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <div className="space-y-4">
              <Skeleton className="h-[120px]" />
              <Skeleton className="h-[120px]" />
            </div>
          </div>
          <Skeleton className="h-48" />
        </div>
      )}

      {/* Data display */}
      {loaded && data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ServerInfoCard health={data.health} />
            <div className="space-y-4">
              <ThemeInfoCard theme={data.health.active_theme} />
              <DiskUsageCard disk={data.health.disk_usage} />
            </div>
          </div>

          <PluginList plugins={data.plugins} />
        </>
      )}
    </div>
  );
}
