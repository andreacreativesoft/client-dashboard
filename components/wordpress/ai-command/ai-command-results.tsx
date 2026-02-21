"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplyResult } from "./ai-command-proposals";

interface AICommandResultsProps {
  websiteId: string;
  results: ApplyResult[];
  onClose: () => void;
}

export function AICommandResults({ websiteId, results, onClose }: AICommandResultsProps) {
  const [rolling, setRolling] = useState(false);
  const [rollbackDone, setRollbackDone] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const rollbackIds = results
    .filter((r) => r.success && r.action_id)
    .map((r) => r.action_id as string);

  async function handleRollback() {
    if (rollbackIds.length === 0) return;
    setRolling(true);
    setRollbackError(null);

    try {
      const res = await fetch(`/api/wordpress/${websiteId}/ai-command/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_ids: rollbackIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setRollbackDone(true);
    } catch (err) {
      setRollbackError((err as Error).message);
    } finally {
      setRolling(false);
    }
  }

  return (
    <Card className={failed > 0 ? "border-yellow-500" : "border-green-500"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {failed === 0 ? (
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            )}
            Results
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Summary */}
        <p className="text-sm">
          <span className="font-medium text-green-600">{succeeded} succeeded</span>
          {failed > 0 && (
            <span className="font-medium text-destructive">, {failed} failed</span>
          )}
        </p>

        {/* Individual results */}
        <div className="space-y-1.5">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-destructive/5"
              }`}
            >
              {result.success ? (
                <svg className="h-3.5 w-3.5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              )}
              <span className={result.success ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                {result.change_id}
                {result.error && `: ${result.error}`}
              </span>
            </div>
          ))}
        </div>

        {/* Rollback */}
        {rollbackIds.length > 0 && !rollbackDone && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRollback}
              disabled={rolling}
              className="h-8 text-xs"
            >
              {rolling ? (
                <>
                  <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Rolling back...
                </>
              ) : (
                `Rollback All (${rollbackIds.length})`
              )}
            </Button>
          </div>
        )}

        {rollbackDone && (
          <p className="text-xs text-green-600">All changes have been rolled back successfully.</p>
        )}

        {rollbackError && (
          <p className="text-xs text-destructive">Rollback error: {rollbackError}</p>
        )}
      </CardContent>
    </Card>
  );
}
