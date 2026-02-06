import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ReportDownloadButton } from "./report-download-button";
import { GenerateReportButton } from "./generate-report-button";
import { getProfile } from "@/lib/actions/profile";

export const metadata: Metadata = {
  title: "Reports",
};

type ReportWithClient = {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  file_path: string;
  file_size: number;
  generated_at: string;
  sent_at: string | null;
  client: { business_name: string } | null;
};

export default async function ReportsPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  const supabase = await createClient();

  // Get reports based on user role
  let query = supabase
    .from("reports")
    .select("*, client:clients(business_name)")
    .order("period_start", { ascending: false });

  // Filter by impersonated client if applicable
  if (impersonatedClientId) {
    query = query.eq("client_id", impersonatedClientId);
  }

  const { data: reports } = await query;
  const typedReports = (reports || []) as ReportWithClient[];

  // Get clients for admin to generate reports
  let clients: { id: string; business_name: string }[] = [];
  if (isAdmin && !impersonatedClientId) {
    const { data } = await supabase
      .from("clients")
      .select("id, business_name")
      .order("business_name");
    clients = data || [];
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        {isAdmin && !impersonatedClientId && clients.length > 0 && (
          <GenerateReportButton clients={clients} />
        )}
      </div>

      {typedReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="text-muted-foreground">
              No reports yet. Monthly reports will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {typedReports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {format(new Date(report.period_start), "MMMM yyyy")}
                </CardTitle>
                {isAdmin && !impersonatedClientId && report.client && (
                  <p className="text-sm text-muted-foreground">
                    {report.client.business_name}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span>
                      {format(new Date(report.period_start), "MMM d")} -{" "}
                      {format(new Date(report.period_end), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated</span>
                    <span>{format(new Date(report.generated_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{(report.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <ReportDownloadButton reportId={report.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
