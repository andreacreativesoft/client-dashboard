import type { Metadata } from "next";
import { getClients } from "@/lib/actions/clients";
import { getWebsitesForClient } from "@/lib/actions/websites";
import { getLatestChecks } from "@/lib/actions/site-checks";
import { ToolsDashboard } from "./tools-dashboard";

export const metadata: Metadata = {
  title: "Admin Tools",
};

export default async function ToolsPage() {
  const clients = await getClients();

  // Fetch websites and latest checks for all clients in parallel
  const clientData = await Promise.all(
    clients.map(async (client) => {
      const [websites, latestChecks] = await Promise.all([
        getWebsitesForClient(client.id),
        getLatestChecks(client.id),
      ]);
      return { client, websites, latestChecks };
    })
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Tools</h1>
        <p className="text-sm text-muted-foreground">
          Run broken link checks, SEO audits, and uptime monitoring for your client websites.
        </p>
      </div>

      <ToolsDashboard clientData={clientData} />
    </div>
  );
}
