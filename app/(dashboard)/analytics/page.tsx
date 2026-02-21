import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/actions/leads";
import { getProfile } from "@/lib/actions/profile";
import { getClientsWithGA4 } from "@/lib/actions/analytics";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { getSelectedClientId } from "@/lib/selected-client";
import { GA4Analytics } from "@/components/analytics/ga4-analytics";
import { t } from "@/lib/i18n/translations";

export const metadata: Metadata = {
  title: "Google Analytics",
};

export default async function AnalyticsPage() {
  const [leads, profile, clientsWithGA4] = await Promise.all([
    getLeads(),
    getProfile(),
    getClientsWithGA4(),
  ]);

  const isAdmin = profile?.role === "admin";
  const lang = profile?.language || "en";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;
  const selectedClientId = isAdmin ? await getSelectedClientId() : null;
  // Use selected client from header dropdown, fall back to impersonated client
  const activeClientId = selectedClientId || impersonatedClientId;

  // Calculate lead stats by time period
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const last30Days = leads.filter((l) => new Date(l.created_at) >= thirtyDaysAgo);
  const last7Days = leads.filter((l) => new Date(l.created_at) >= sevenDaysAgo);

  // Group leads by day for the chart
  const dailyLeads: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split("T")[0] ?? "";
    if (key) dailyLeads[key] = 0;
  }
  for (const lead of last30Days) {
    const key = lead.created_at.split("T")[0] ?? "";
    if (key && dailyLeads[key] !== undefined) {
      dailyLeads[key]++;
    }
  }

  // Status breakdown
  const statusCounts = {
    new: last30Days.filter((l) => l.status === "new").length,
    contacted: last30Days.filter((l) => l.status === "contacted").length,
    done: last30Days.filter((l) => l.status === "done").length,
  };

  // Top sources
  const sourceCounts: Record<string, number> = {};
  for (const lead of last30Days) {
    const source = lead.website_name;
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">{t(lang, "analytics.title")}</h1>

      {/* ─── GA4 Website Analytics ─────────────────────────────────── */}
      <div className="mb-8">
        <GA4Analytics
          clientsWithGA4={clientsWithGA4}
          isAdmin={isAdmin}
          initialClientId={activeClientId || undefined}
        />
      </div>

      {/* ─── Lead Analytics ────────────────────────────────────────── */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{t(lang, "analytics.lead_analytics")}</h2>
      </div>

      {/* Stats Overview */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{last30Days.length}</p>
            <p className="text-sm font-medium">{t(lang, "dashboard.total_leads")}</p>
            <p className="text-xs text-muted-foreground">{t(lang, "dashboard.last_30_days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{last7Days.length}</p>
            <p className="text-sm font-medium">{t(lang, "analytics.this_week")}</p>
            <p className="text-xs text-muted-foreground">{t(lang, "analytics.last_7_days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">
              {last30Days.length > 0
                ? Math.round((statusCounts.done / last30Days.length) * 100)
                : 0}
              %
            </p>
            <p className="text-sm font-medium">{t(lang, "analytics.conversion")}</p>
            <p className="text-xs text-muted-foreground">{t(lang, "analytics.marked_as_done")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{topSources.length}</p>
            <p className="text-sm font-medium">{t(lang, "analytics.active_sources")}</p>
            <p className="text-xs text-muted-foreground">{t(lang, "analytics.with_leads")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Trend - Simple bar visualization */}
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "analytics.lead_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-1">
              {Object.entries(dailyLeads).map(([date, count]) => {
                const maxCount = Math.max(...Object.values(dailyLeads), 1);
                const height = count > 0 ? Math.max((count / maxCount) * 100, 4) : 2;
                return (
                  <div
                    key={date}
                    className="flex-1 rounded-t bg-foreground transition-all hover:bg-foreground/80"
                    style={{ height: `${height}%` }}
                    title={`${date}: ${count} leads`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{t(lang, "analytics.days_ago")}</span>
              <span>{t(lang, "analytics.today")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "analytics.status_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: t(lang, "dashboard.new"), count: statusCounts.new, color: "bg-foreground" },
                { label: t(lang, "dashboard.contacted"), count: statusCounts.contacted, color: "bg-warning" },
                { label: t(lang, "dashboard.done"), count: statusCounts.done, color: "bg-success" },
              ].map((status) => {
                const percent =
                  last30Days.length > 0
                    ? Math.round((status.count / last30Days.length) * 100)
                    : 0;
                return (
                  <div key={status.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{status.label}</span>
                      <span className="text-muted-foreground">
                        {status.count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${status.color} transition-all`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Sources */}
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "analytics.top_sources")}</CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(lang, "analytics.no_leads_yet")}</p>
            ) : (
              <div className="space-y-3">
                {topSources.map(([source, count], index) => (
                  <div
                    key={source}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm">{source}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
