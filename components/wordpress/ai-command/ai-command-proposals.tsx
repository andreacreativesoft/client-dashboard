"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProposalData } from "./ai-command-input";

interface AICommandProposalsProps {
  websiteId: string;
  proposal: ProposalData;
  onApplied: (results: ApplyResult[]) => void;
  onClose: () => void;
}

export interface ApplyResult {
  change_id: string;
  success: boolean;
  error?: string;
  action_id?: string;
}

interface SelectableChange {
  id: string;
  resource_type: string;
  resource_id: string;
  resource_title: string;
  field: string;
  current_value: string;
  proposed_value: string;
  selected: boolean;
}

export function AICommandProposals({ websiteId, proposal, onApplied, onClose }: AICommandProposalsProps) {
  const [changes, setChanges] = useState<SelectableChange[]>(() =>
    proposal.changes.map((c, i) => ({
      ...c,
      id: `change_${i}`,
      selected: true,
    }))
  );
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedCount = changes.filter((c) => c.selected).length;
  const totalCount = changes.length;

  function toggleChange(id: string) {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  }

  function selectAll() {
    setChanges((prev) => prev.map((c) => ({ ...c, selected: true })));
  }

  function deselectAll() {
    setChanges((prev) => prev.map((c) => ({ ...c, selected: false })));
  }

  async function handleApply() {
    setShowConfirm(false);
    setApplying(true);

    try {
      const res = await fetch(`/api/wordpress/${websiteId}/ai-command/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data: { results: ApplyResult[] } = await res.json();
      onApplied(data.results);
    } catch (error) {
      onApplied([{ change_id: "all", success: false, error: (error as Error).message }]);
    } finally {
      setApplying(false);
    }
  }

  const resourceTypeLabel: Record<string, string> = {
    media: "Media",
    page: "Page",
    post: "Post",
    plugin: "Plugin",
    menu_item: "Menu",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Proposed Changes
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Description */}
        <p className="text-sm text-muted-foreground">{proposal.description}</p>

        {/* Selection controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs font-medium hover:underline">
              Select All
            </button>
            <span className="text-xs text-muted-foreground">|</span>
            <button onClick={deselectAll} className="text-xs font-medium hover:underline">
              Deselect All
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Changes table */}
        <div className="overflow-hidden rounded-lg border border-border">
          {/* Header */}
          <div className="hidden grid-cols-[40px_1fr_100px_1fr_1fr] gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground md:grid">
            <span></span>
            <span>Resource</span>
            <span>Field</span>
            <span>Current</span>
            <span>Proposed</span>
          </div>

          <div className="divide-y divide-border">
            {changes.map((change) => (
              <label
                key={change.id}
                className={`flex cursor-pointer flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50 md:grid md:grid-cols-[40px_1fr_100px_1fr_1fr] md:items-start ${
                  !change.selected ? "opacity-50" : ""
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center gap-2 md:block">
                  <input
                    type="checkbox"
                    checked={change.selected}
                    onChange={() => toggleChange(change.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-xs font-medium md:hidden">
                    {change.resource_title}
                  </span>
                </div>

                {/* Resource */}
                <div className="hidden min-w-0 md:block">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {resourceTypeLabel[change.resource_type] || change.resource_type}
                    </Badge>
                    <span className="truncate text-xs font-medium">
                      {change.resource_title}
                    </span>
                  </div>
                </div>

                {/* Field */}
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium md:hidden">Field: </span>
                  {change.field}
                </span>

                {/* Current value */}
                <div className="min-w-0">
                  <span className="font-medium text-xs md:hidden text-muted-foreground">Current: </span>
                  <span className={`text-xs ${change.current_value ? "text-muted-foreground" : "italic text-muted-foreground/50"}`}>
                    {change.current_value
                      ? truncateValue(change.current_value, 100)
                      : "(empty)"}
                  </span>
                </div>

                {/* Proposed value */}
                <div className="min-w-0">
                  <span className="font-medium text-xs md:hidden text-muted-foreground">Proposed: </span>
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    {truncateValue(change.proposed_value, 100)}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Usage info */}
        {proposal.usage && (
          <p className="text-[10px] text-muted-foreground">
            AI tokens used: {proposal.usage.input_tokens.toLocaleString()} in / {proposal.usage.output_tokens.toLocaleString()} out
          </p>
        )}

        {/* Apply button */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {showConfirm ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
              <span className="text-xs">
                Apply {selectedCount} change{selectedCount !== 1 ? "s" : ""}?
                This will be logged and can be rolled back.
              </span>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={applying}
                className="h-7 text-xs"
              >
                {applying ? "Applying..." : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={selectedCount === 0 || applying}
            >
              {applying ? (
                <>
                  <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Applying...
                </>
              ) : (
                `Apply ${selectedCount} Change${selectedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function truncateValue(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + "...";
}
