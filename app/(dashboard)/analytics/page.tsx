import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/actions/leads";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const leads = await getLeads();

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
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>

      {/* Stats Overview */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{last30Days.length}</p>
            <p className="text-sm font-medium">Total Leads</p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{last7Days.length}</p>
            <p className="text-sm font-medium">This Week</p>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
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
            <p className="text-sm font-medium">Conversion</p>
            <p className="text-xs text-muted-foreground">Marked as done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{topSources.length}</p>
            <p className="text-sm font-medium">Active Sources</p>
            <p className="text-xs text-muted-foreground">With leads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Trend - Simple bar visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Trend (30 days)</CardTitle>
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
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "New", count: statusCounts.new, color: "bg-foreground" },
                { label: "Contacted", count: statusCounts.contacted, color: "bg-warning" },
                { label: "Done", count: statusCounts.done, color: "bg-success" },
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
            <CardTitle>Top Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet</p>
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
