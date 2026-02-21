import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient } from "@/lib/actions/clients";
import { getWebsitesForClient } from "@/lib/actions/websites";
import { getClientActivity } from "@/lib/actions/activity";
import { getIntegrationsForClient } from "@/lib/actions/integrations";
import { getLeadCountForClient } from "@/lib/actions/leads";
import { getLatestChecks } from "@/lib/actions/site-checks";
import { WebsitesList } from "./websites-list";
import { AdminNotes } from "./admin-notes";
import { ContactInfo } from "./contact-info";
import { ActivityLog } from "@/components/activity-log";
import { ClientTools } from "@/components/tools/client-tools";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Client Detail",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [client, websites, activities, integrations, leadCount, latestChecks] = await Promise.all([
    getClient(id),
    getWebsitesForClient(id),
    getClientActivity(id, 20),
    getIntegrationsForClient(id),
    getLeadCountForClient(id),
    getLatestChecks(id),
  ]);

  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

  if (!client) {
    notFound();
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Clients
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.business_name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(client.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <WebsitesList
            clientId={client.id}
            websites={websites}
            integrations={integrations}
            googleConfigured={googleConfigured}
            appUrl={appUrl}
          />
          <ClientTools websites={websites} latestChecks={latestChecks} />
        </div>

        <div className="space-y-6">
          <ContactInfo
            clientId={client.id}
            contactEmail={client.contact_email}
            contactPhone={client.contact_phone}
          />

          <AdminNotes clientId={client.id} initialNotes={client.notes} />

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Websites</span>
                <span className="font-medium">{websites.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Leads</span>
                <span className="font-medium">{leadCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityLog activities={activities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
