"use client";

import { useState, useCallback } from "react";
import { BrokenLinksChecker } from "@/components/tools/broken-links-checker";
import { SeoAuditor } from "@/components/tools/seo-auditor";
import { UptimeChecker } from "@/components/tools/uptime-checker";
import { SecurityChecker } from "@/components/tools/security-checker";
import { Badge } from "@/components/ui/badge";
import type { Client, Website, SiteCheck } from "@/types/database";

interface ClientData {
  client: Client;
  websites: Website[];
  latestChecks: SiteCheck[];
}

interface ToolsDashboardProps {
  clientData: ClientData[];
}

type ToolTab = "broken_links" | "seo_audit" | "uptime" | "security";

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "success" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}/100</Badge>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ToolsDashboard({ clientData }: ToolsDashboardProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>("broken_links");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Flatten all websites with client info
  const allWebsites = clientData.flatMap((cd) =>
    cd.websites.map((w) => ({ ...w, clientName: cd.client.business_name }))
  );

  // Find latest check for a website+type combo
  function getLatestCheck(websiteId: string, checkType: string): SiteCheck | null {
    for (const cd of clientData) {
      const check = cd.latestChecks.find(
        (c) => c.website_id === websiteId && c.check_type === checkType
      );
      if (check) return check;
    }
    return null;
  }

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    setExpandedIds(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const tabs: { key: ToolTab; label: string }[] = [
    { key: "broken_links", label: "Broken Links" },
    { key: "seo_audit", label: "SEO Audit" },
    { key: "uptime", label: "Uptime" },
    { key: "security", label: "Security" },
  ];

  const websitesToShow = selectedWebsiteId
    ? allWebsites.filter((w) => w.id === selectedWebsiteId)
    : allWebsites;

  const allExpanded = websitesToShow.length > 0 && websitesToShow.every((w) => expandedIds.has(w.id));

  return (
    <div>
      {/* Tab navigation */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Website filter + expand/collapse */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={selectedWebsiteId}
          onChange={(e) => setSelectedWebsiteId(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm md:w-auto"
        >
          <option value="">All websites ({allWebsites.length})</option>
          {clientData.map((cd) => (
            <optgroup key={cd.client.id} label={cd.client.business_name}>
              {cd.websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.url}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {websitesToShow.length > 1 && (
          <button
            onClick={() =>
              allExpanded ? collapseAll() : expandAll(websitesToShow.map((w) => w.id))
            }
            className="rounded border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {/* Accordion website cards */}
      {allWebsites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No websites found. Add websites to clients first.
        </p>
      ) : (
        <div className="space-y-2">
          {websitesToShow.map((website) => {
            const isOpen = expandedIds.has(website.id);
            const lastCheck = getLatestCheck(website.id, activeTab);

            return (
              <div
                key={website.id}
                className="rounded-lg border border-border overflow-hidden"
              >
                {/* Accordion header */}
                <button
                  onClick={() => toggleExpanded(website.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <ChevronIcon open={isOpen} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {website.clientName} — {website.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        {website.url}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {lastCheck?.score != null && (
                      <ScoreBadge score={Math.round(lastCheck.score)} />
                    )}
                    {lastCheck && !lastCheck.score && lastCheck.status === "completed" && (
                      <Badge variant="secondary">Checked</Badge>
                    )}
                    {!lastCheck && (
                      <Badge variant="outline">Not checked</Badge>
                    )}
                  </div>
                </button>

                {/* Accordion content */}
                {isOpen && (
                  <div className="border-t border-border">
                    {activeTab === "broken_links" && (
                      <BrokenLinksChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={lastCheck}
                      />
                    )}
                    {activeTab === "seo_audit" && (
                      <SeoAuditor
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={lastCheck}
                      />
                    )}
                    {activeTab === "uptime" && (
                      <UptimeChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={lastCheck}
                      />
                    )}
                    {activeTab === "security" && (
                      <SecurityChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={lastCheck}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
