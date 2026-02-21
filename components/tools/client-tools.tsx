"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrokenLinksChecker } from "./broken-links-checker";
import { SeoAuditor } from "./seo-auditor";
import { UptimeChecker } from "./uptime-checker";
import { SecurityChecker } from "./security-checker";
import type { Website, SiteCheck } from "@/types/database";

interface ClientToolsProps {
  websites: Website[];
  latestChecks: SiteCheck[];
}

export function ClientTools({ websites, latestChecks }: ClientToolsProps) {
  function getCheck(websiteId: string, checkType: string): SiteCheck | null {
    return latestChecks.find(
      (c) => c.website_id === websiteId && c.check_type === checkType
    ) || null;
  }

  if (websites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {websites.map((website) => (
            <div key={website.id}>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                {website.name}
              </p>
              <div className="space-y-2">
                <BrokenLinksChecker
                  websiteId={website.id}
                  websiteName={website.name}
                  websiteUrl={website.url}
                  lastCheck={getCheck(website.id, "broken_links")}
                  compact
                />
                <SeoAuditor
                  websiteId={website.id}
                  websiteName={website.name}
                  websiteUrl={website.url}
                  lastCheck={getCheck(website.id, "seo_audit")}
                  compact
                />
                <UptimeChecker
                  websiteId={website.id}
                  websiteName={website.name}
                  websiteUrl={website.url}
                  lastCheck={getCheck(website.id, "uptime")}
                  compact
                />
                <SecurityChecker
                  websiteId={website.id}
                  websiteName={website.name}
                  websiteUrl={website.url}
                  lastCheck={getCheck(website.id, "security")}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
