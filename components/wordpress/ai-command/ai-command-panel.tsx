"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AICommandInput, type ProposalData } from "./ai-command-input";
import { AICommandProposals, type ApplyResult } from "./ai-command-proposals";
import { AICommandResults } from "./ai-command-results";
import { AICommandHistory } from "./ai-command-history";

interface AICommandPanelProps {
  websiteId: string;
}

type View = "input" | "proposals" | "results";

export function AICommandPanel({ websiteId }: AICommandPanelProps) {
  const [view, setView] = useState<View>("input");
  const [message, setMessage] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [results, setResults] = useState<ApplyResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  function handleProposal(data: ProposalData) {
    setProposal(data);
    setView("proposals");
  }

  function handleMessage(msg: string) {
    setMessage(msg);
  }

  function handleApplied(res: ApplyResult[]) {
    setResults(res);
    setView("results");
  }

  function handleReset() {
    setView("input");
    setProposal(null);
    setResults([]);
    setMessage(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">AI Commands</h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {showHistory ? "Hide History" : "Show History"}
        </button>
      </div>

      {/* Input (always visible unless viewing proposals/results) */}
      {view === "input" && (
        <AICommandInput
          websiteId={websiteId}
          onProposal={handleProposal}
          onMessage={handleMessage}
        />
      )}

      {/* Claude message */}
      {message && view === "input" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              AI Response
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      )}

      {/* Proposals */}
      {view === "proposals" && proposal && (
        <AICommandProposals
          websiteId={websiteId}
          proposal={proposal}
          onApplied={handleApplied}
          onClose={handleReset}
        />
      )}

      {/* Results */}
      {view === "results" && (
        <AICommandResults
          websiteId={websiteId}
          results={results}
          onClose={handleReset}
        />
      )}

      {/* History */}
      {showHistory && <AICommandHistory websiteId={websiteId} />}
    </div>
  );
}
