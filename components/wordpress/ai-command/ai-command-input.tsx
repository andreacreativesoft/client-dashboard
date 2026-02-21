"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AICommandInputProps {
  websiteId: string;
  onProposal: (proposal: ProposalData) => void;
  onMessage: (message: string) => void;
  disabled?: boolean;
}

export interface ProposalData {
  description: string;
  changes: {
    resource_type: string;
    resource_id: string;
    resource_title: string;
    field: string;
    current_value: string;
    proposed_value: string;
  }[];
  usage?: { input_tokens: number; output_tokens: number };
}

const SUGGESTION_CHIPS = [
  { label: "ALT Text", command: "Find all images missing ALT text and generate descriptive ALT text for each one." },
  { label: "Meta Descriptions", command: "Audit all pages and generate meta descriptions for any that are missing one." },
  { label: "H1 Audit", command: "Check all pages for H1 tag issues — missing H1, multiple H1s, or empty H1 tags." },
  { label: "SEO Audit", command: "Perform a comprehensive SEO audit — check titles, meta descriptions, headings, alt text, and schema markup." },
  { label: "Content Audit", command: "Find pages with thin content (under 300 words) and suggest improvements." },
];

export function AICommandInput({ websiteId, onProposal, onMessage, disabled }: AICommandInputProps) {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    const trimmed = command.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setStatus("Sending command to AI...");

    try {
      const res = await fetch(`/api/wordpress/${websiteId}/ai-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.type === "error") {
        throw new Error(data.message);
      }

      // Show Claude's text message
      if (data.message) {
        onMessage(data.message);
      }

      // Show proposal if one was generated
      if (data.proposal) {
        onProposal({
          description: data.proposal.description || "",
          changes: data.proposal.changes || [],
          usage: data.usage,
        });
      }

      setStatus(null);
    } catch (err) {
      setError((err as Error).message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleChipClick(chipCommand: string) {
    setCommand(chipCommand);
    textareaRef.current?.focus();
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Input area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Add ALT text to all images missing it"
            disabled={loading || disabled}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 pr-20 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !command.trim() || disabled}
            className="absolute bottom-3 right-3 h-8"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              "Run"
            )}
          </Button>
        </div>

        {/* Suggestion chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleChipClick(chip.command)}
              disabled={loading || disabled}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Status / Loading */}
        {status && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/5 p-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
