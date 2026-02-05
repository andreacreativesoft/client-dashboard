export interface ReportData {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;

  // Lead stats
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  completedLeads: number;
  leadsBySource: { source: string; count: number }[];
  leadsByWebsite: { website: string; count: number }[];
  leadsTrend: { date: string; count: number }[];

  // Analytics (from GA4 if connected)
  totalVisitors?: number;
  totalPageviews?: number;
  avgSessionDuration?: string;
  bounceRate?: string;
  visitorsTrend?: { date: string; count: number }[];

  // Top performing
  topFormNames: { name: string; count: number }[];
}

export interface StoredReport {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  file_path: string;
  file_size: number;
  generated_at: string;
  sent_at: string | null;
  created_at: string;
}
