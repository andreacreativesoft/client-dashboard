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
        <div className="space-y-4">
          {websitesToShow.map((website) => (
            <div key={website.id}>
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
          ))}
        </div>
      )}
    </div>
  );
}
