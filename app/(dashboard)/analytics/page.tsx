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
  // Impersonation takes priority over header dropdown selection
  const activeClientId = impersonatedClientId || selectedClientId;

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
    <div className="px-8 py-12">
      <h1 className="mb-6 text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{t(lang, "analytics.title")}</h1>

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
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {last30Days.length}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "dashboard.total_leads")}</p>
          </div>
          <p className="text-[14px] leading-[1.5] text-[#6D6A65]">{t(lang, "dashboard.last_30_days")}</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {last7Days.length}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "analytics.this_week")}</p>
          </div>
          <p className="text-[14px] leading-[1.5] text-[#6D6A65]">{t(lang, "analytics.last_7_days")}</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {last30Days.length > 0 ? Math.round((statusCounts.done / last30Days.length) * 100) : 0}%
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "analytics.conversion")}</p>
          </div>
          <p className="text-[14px] leading-[1.5] text-[#6D6A65]">{t(lang, "analytics.marked_as_done")}</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {topSources.length}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "analytics.active_sources")}</p>
          </div>
          <p className="text-[14px] leading-[1.5] text-[#6D6A65]">{t(lang, "analytics.with_leads")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Trend - Simple bar visualization */}
        <div className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <p className="mb-4 text-[16px] font-bold text-[#2E2E2E]">{t(lang, "analytics.lead_trend")}</p>
          <div className="flex h-32 items-end gap-1">
            {Object.entries(dailyLeads).map(([date, count], i) => {
              const maxCount = Math.max(...Object.values(dailyLeads), 1);
              const height = count > 0 ? Math.max((count / maxCount) * 100, 4) : 2;
              return (
                <div
                  key={date}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${height}%`,
                    backgroundColor: i % 2 === 0 ? "#2A5959" : "#F2612E",
                  }}
                  title={`${date}: ${count} leads`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#6D6A65]">
            <span>{t(lang, "analytics.days_ago")}</span>
            <span>{t(lang, "analytics.today")}</span>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <p className="mb-4 text-[16px] font-bold text-[#2E2E2E]">{t(lang, "analytics.status_breakdown")}</p>
          <div className="space-y-4">
            {[
              { label: t(lang, "dashboard.new"), count: statusCounts.new, color: "#2A5959" },
              { label: t(lang, "dashboard.contacted"), count: statusCounts.contacted, color: "#F2612E" },
              { label: t(lang, "dashboard.done"), count: statusCounts.done, color: "#2A5959" },
            ].map((status) => {
              const percent =
                last30Days.length > 0
                  ? Math.round((status.count / last30Days.length) * 100)
                  : 0;
              return (
                <div key={status.label}>
                  <div className="mb-1 flex justify-between text-[14px]">
                    <span className="text-[#2E2E2E]">{status.label}</span>
                    <span className="text-[#6D6A65]">
                      {status.count} ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#DDE9E5]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: status.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Sources */}
        <div className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
          <p className="mb-4 text-[16px] font-bold text-[#2E2E2E]">{t(lang, "analytics.top_sources")}</p>
          {topSources.length === 0 ? (
            <p className="text-[14px] text-[#6D6A65]">{t(lang, "analytics.no_leads_yet")}</p>
          ) : (
            <div className="space-y-3">
              {topSources.map(([source, count], index) => (
                <div
                  key={source}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: index % 2 === 0 ? "#2A5959" : "#F2612E" }}>
                      {index + 1}
                    </span>
                    <span className="text-[14px] text-[#2E2E2E]">{source}</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#2E2E2E]">{count}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
