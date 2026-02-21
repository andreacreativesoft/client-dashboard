"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WPActionQueueRow } from "@/types/database";

interface AICommandHistoryProps {
  websiteId: string;
}

type StatusFilter = "all" | "completed" | "failed" | "rolled_back" | "pending" | "processing";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-600 text-white",
  failed: "bg-destructive text-white",
  rolled_back: "bg-muted text-muted-foreground",
  pending: "bg-yellow-600 text-white",
  processing: "bg-blue-600 text-white",
};

export function AICommandHistory({ websiteId }: AICommandHistoryProps) {
  const [actions, setActions] = useState<WPActionQueueRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isPending, startTransition] = useTransition();
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  function fetchHistory() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/wordpress/${websiteId}/ai-command/history`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data: { actions: WPActionQueueRow[] } = await res.json();
        setActions(data.actions);
        setLoaded(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  async function handleRollback(actionId: string) {
    setRollingBack(actionId);
    try {
      const res = await fetch(`/api/wordpress/${websiteId}/ai-command/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_ids: [actionId] }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Refresh
      fetchHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRollingBack(null);
    }
  }

  const filtered = filter === "all" ? actions : actions.filter((a) => a.status === filter);

  // Status counts
  const counts = actions.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Action History
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchHistory}
            disabled={isPending}
            className="h-8 text-xs"
          >
            {isPending ? "Loading..." : loaded ? "Refresh" : "Load History"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/5 p-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {!loaded && !isPending && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Load History&quot; to see past AI command actions.
          </p>
        )}

        {loaded && (
          <>
            {/* Filter pills */}
            {actions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    filter === "all" ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  All ({actions.length})
                </button>
                {(["completed", "failed", "rolled_back", "pending"] as StatusFilter[]).map((s) =>
                  counts[s] ? (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        filter === s ? STATUS_STYLES[s] : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {s.replace("_", " ")} ({counts[s]})
                    </button>
                  ) : null
                )}
              </div>
            )}

            {/* Actions list */}
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {actions.length === 0 ? "No actions yet." : "No actions match the filter."}
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {filtered.map((action) => {
                    const payload = action.action_payload as Record<string, unknown>;
                    return (
                      <div key={action.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${STATUS_STYLES[action.status] || "bg-muted"}`}>
                              {action.status.replace("_", " ")}
                            </Badge>
                            <span className="text-xs font-medium">
                              {action.action_type}
                            </span>
                            {action.resource_type && (
                              <span className="text-[10px] text-muted-foreground">
                                {action.resource_type} #{action.resource_id}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>
                              {new Date(action.created_at).toLocaleString()}
                            </span>
                            {typeof payload.field === "string" && (
                              <span>Field: {payload.field}</span>
                            )}
                          </div>
                          {action.error_message && (
                            <p className="mt-0.5 text-[10px] text-destructive">
                              {action.error_message}
                            </p>
                          )}
                        </div>

                        {/* Rollback button */}
                        {action.status === "completed" && action.before_state && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRollback(action.id)}
                            disabled={rollingBack === action.id}
                            className="h-7 shrink-0 text-[10px]"
                          >
                            {rollingBack === action.id ? "..." : "Rollback"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
