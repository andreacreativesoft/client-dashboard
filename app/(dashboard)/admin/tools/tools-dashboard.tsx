"use client";

import { useState } from "react";
import { BrokenLinksChecker } from "@/components/tools/broken-links-checker";
import { SeoAuditor } from "@/components/tools/seo-auditor";
import { UptimeChecker } from "@/components/tools/uptime-checker";
import { SecurityChecker } from "@/components/tools/security-checker";
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

export function ToolsDashboard({ clientData }: ToolsDashboardProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>("broken_links");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [expandedWebsites, setExpandedWebsites] = useState<Set<string>>(new Set());

  function toggleWebsite(websiteId: string) {
    setExpandedWebsites((prev) => {
      const next = new Set(prev);
      if (next.has(websiteId)) {
        next.delete(websiteId);
      } else {
        next.add(websiteId);
      }
      return next;
    });
  }

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

  const tabs: { key: ToolTab; label: string }[] = [
    { key: "broken_links", label: "Broken Links" },
    { key: "seo_audit", label: "SEO Audit" },
    { key: "uptime", label: "Uptime" },
    { key: "security", label: "Security" },
  ];

  const websitesToShow = selectedWebsiteId
    ? allWebsites.filter((w) => w.id === selectedWebsiteId)
    : allWebsites;

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

      {/* Website filter */}
      <div className="mb-4">
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
      </div>

      {/* Tool cards */}
      {allWebsites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No websites found. Add websites to clients first.
        </p>
      ) : (
        <div className="space-y-2">
          {websitesToShow.map((website) => {
            const isExpanded = expandedWebsites.has(website.id);
            const lastCheck = getLatestCheck(website.id, activeTab);
            const hasScore = lastCheck?.score != null;

            return (
              <div key={website.id} className="rounded-lg border border-border">
                {/* Collapsible header */}
                <button
                  onClick={() => toggleWebsite(website.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {website.clientName} — {website.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{website.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hasScore && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        (lastCheck.score ?? 0) >= 80
                          ? "bg-success/10 text-success"
                          : (lastCheck.score ?? 0) >= 50
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                      }`}>
                        {lastCheck.score}/100
                      </span>
                    )}
                    {lastCheck?.status === "completed" && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(lastCheck.created_at).toLocaleDateString()}
                      </span>
                    )}
                    <svg
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {/* Collapsible content */}
                {isExpanded && (
                  <div className="border-t border-border p-4">
                    {activeTab === "broken_links" && (
                      <BrokenLinksChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={getLatestCheck(website.id, "broken_links")}
                      />
                    )}
                    {activeTab === "seo_audit" && (
                      <SeoAuditor
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={getLatestCheck(website.id, "seo_audit")}
                      />
                    )}
                    {activeTab === "uptime" && (
                      <UptimeChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={getLatestCheck(website.id, "uptime")}
                      />
                    )}
                    {activeTab === "security" && (
                      <SecurityChecker
                        websiteId={website.id}
                        websiteName={`${website.clientName} — ${website.name}`}
                        websiteUrl={website.url}
                        lastCheck={getLatestCheck(website.id, "security")}
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
