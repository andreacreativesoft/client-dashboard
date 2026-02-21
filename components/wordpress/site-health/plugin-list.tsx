"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PluginInfo } from "@/types/wordpress";

interface PluginListProps {
  plugins: PluginInfo[];
}

type StatusFilter = "all" | "active" | "inactive" | "must-use" | "updates";
type SortKey = "name" | "status" | "update";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-600 text-white",
  inactive: "bg-muted text-muted-foreground",
  "must-use": "bg-blue-600 text-white",
};

export function PluginList({ plugins }: PluginListProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Counts
  const activeCount = plugins.filter((p) => p.status === "active").length;
  const inactiveCount = plugins.filter((p) => p.status === "inactive").length;
  const mustUseCount = plugins.filter((p) => p.status === "must-use").length;
  const updatesCount = plugins.filter((p) => p.update_available).length;

  // Filter
  const filtered = plugins.filter((p) => {
    if (filter === "all") return true;
    if (filter === "updates") return p.update_available;
    return p.status === filter;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "status") return a.status.localeCompare(b.status);
    // Sort by update availability (updates first)
    if (sortKey === "update") {
      if (a.update_available === b.update_available) return a.name.localeCompare(b.name);
      return a.update_available ? -1 : 1;
    }
    return 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
            </svg>
            Plugins
          </CardTitle>

          {/* Summary counts */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{activeCount} active</span>
            <span className="text-border">|</span>
            <span>{inactiveCount} inactive</span>
            {mustUseCount > 0 && (
              <>
                <span className="text-border">|</span>
                <span>{mustUseCount} must-use</span>
              </>
            )}
            {updatesCount > 0 && (
              <>
                <span className="text-border">|</span>
                <span className="font-medium text-yellow-600">{updatesCount} update{updatesCount !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Filter + Sort bar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-1">
            {([
              { key: "all" as StatusFilter, label: "All", count: plugins.length },
              { key: "active" as StatusFilter, label: "Active", count: activeCount },
              { key: "inactive" as StatusFilter, label: "Inactive", count: inactiveCount },
              { key: "updates" as StatusFilter, label: "Has Updates", count: updatesCount },
            ]).map((f) =>
              f.count > 0 || f.key === "all" ? (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    filter === f.key
                      ? "bg-foreground text-background"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ) : null
            )}
          </div>

          {/* Sort select */}
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span>Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="update">Updates</option>
            </select>
          </div>
        </div>

        {/* Plugin list */}
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No plugins match the selected filter.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Header */}
            <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground sm:grid">
              <span>Plugin</span>
              <span className="w-16 text-center">Version</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-28 text-center">Update</span>
            </div>

            <div className="divide-y divide-border">
              {sorted.map((plugin) => {
                const isExpanded = expandedSlug === plugin.slug;

                return (
                  <div key={plugin.slug}>
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedSlug(isExpanded ? null : plugin.slug)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 sm:grid sm:grid-cols-[1fr_auto_auto_auto]"
                    >
                      {/* Name + Author */}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{plugin.name}</span>
                        {plugin.author && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            by {stripHtml(plugin.author)}
                          </span>
                        )}
                      </div>

                      {/* Version */}
                      <span className="w-16 text-center text-xs text-muted-foreground">
                        {plugin.version}
                      </span>

                      {/* Status */}
                      <div className="flex w-20 justify-center">
                        <Badge className={`text-[10px] ${STATUS_STYLES[plugin.status] || STATUS_STYLES.inactive}`}>
                          {plugin.status === "must-use" ? "MU" : plugin.status}
                        </Badge>
                      </div>

                      {/* Update */}
                      <div className="flex w-28 justify-center">
                        {plugin.update_available && plugin.update_version ? (
                          <Badge className="bg-yellow-600 text-[10px] text-white hover:bg-yellow-700">
                            Update to {plugin.update_version}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">
                            Up to date
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded description */}
                    {isExpanded && plugin.description && (
                      <div className="border-t border-border bg-muted/30 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">
                          {stripHtml(plugin.description)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground/80">
                          {plugin.requires_wp && (
                            <span>Requires WP {plugin.requires_wp}+</span>
                          )}
                          {plugin.requires_php && (
                            <span>Requires PHP {plugin.requires_php}+</span>
                          )}
                          {plugin.plugin_uri && (
                            <a
                              href={plugin.plugin_uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Plugin page &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Strip HTML tags from a string (for plugin author/description fields). */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
