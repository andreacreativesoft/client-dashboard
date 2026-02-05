import { createAdminClient } from "@/lib/supabase/admin";
import { startOfMonth, endOfMonth, subMonths, format, eachDayOfInterval } from "date-fns";
import type { ReportData } from "./types";

type LeadRow = {
  id: string;
  status: string;
  source: string | null;
  form_name: string | null;
  website_id: string;
  created_at: string;
  website: { name: string } | null;
};

export async function gatherReportData(
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ReportData | null> {
  const supabase = createAdminClient();

  // Get client info
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, logo_url")
    .eq("id", clientId)
    .single();

  if (!client) return null;

  // Get leads for the period
  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, source, form_name, website_id, created_at, website:websites(name)")
    .eq("client_id", clientId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString())
    .returns<LeadRow[]>();

  const leadsData = leads || [];

  // Calculate lead stats
  const totalLeads = leadsData.length;
  const newLeads = leadsData.filter((l) => l.status === "new").length;
  const contactedLeads = leadsData.filter((l) => l.status === "contacted").length;
  const completedLeads = leadsData.filter((l) => l.status === "done").length;

  // Leads by source
  const sourceMap = new Map<string, number>();
  leadsData.forEach((l) => {
    const source = l.source || "unknown";
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });
  const leadsBySource = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Leads by website
  const websiteMap = new Map<string, number>();
  leadsData.forEach((l) => {
    const website = l.website?.name || "Unknown";
    websiteMap.set(website, (websiteMap.get(website) || 0) + 1);
  });
  const leadsByWebsite = Array.from(websiteMap.entries())
    .map(([website, count]) => ({ website, count }))
    .sort((a, b) => b.count - a.count);

  // Leads trend (daily)
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const leadsTrend = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const count = leadsData.filter(
      (l) => format(new Date(l.created_at), "yyyy-MM-dd") === dayStr
    ).length;
    return { date: format(day, "MMM d"), count };
  });

  // Top form names
  const formMap = new Map<string, number>();
  leadsData.forEach((l) => {
    const formName = l.form_name || "Contact Form";
    formMap.set(formName, (formMap.get(formName) || 0) + 1);
  });
  const topFormNames = Array.from(formMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get analytics data if available
  const { data: analyticsData } = await supabase
    .from("analytics_cache")
    .select("data")
    .eq("client_id", clientId)
    .eq("integration_type", "ga4")
    .gte("period_start", format(periodStart, "yyyy-MM-dd"))
    .lte("period_end", format(periodEnd, "yyyy-MM-dd"))
    .single();

  let totalVisitors: number | undefined;
  let totalPageviews: number | undefined;
  let avgSessionDuration: string | undefined;
  let bounceRate: string | undefined;

  if (analyticsData?.data) {
    const data = analyticsData.data as Record<string, unknown>;
    totalVisitors = data.totalUsers as number | undefined;
    totalPageviews = data.screenPageViews as number | undefined;
    avgSessionDuration = data.averageSessionDuration as string | undefined;
    bounceRate = data.bounceRate as string | undefined;
  }

  return {
    clientId: client.id,
    clientName: client.business_name,
    clientLogo: client.logo_url || undefined,
    periodStart,
    periodEnd,
    generatedAt: new Date(),
    totalLeads,
    newLeads,
    contactedLeads,
    completedLeads,
    leadsBySource,
    leadsByWebsite,
    leadsTrend,
    topFormNames,
    totalVisitors,
    totalPageviews,
    avgSessionDuration,
    bounceRate,
  };
}

export function getLastMonthPeriod(): { start: Date; end: Date } {
  const lastMonth = subMonths(new Date(), 1);
  return {
    start: startOfMonth(lastMonth),
    end: endOfMonth(lastMonth),
  };
}
