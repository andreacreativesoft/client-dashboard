import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getLeads } from "@/lib/actions/leads";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { timeAgo, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const profile = await getProfile();
  const leads = await getLeads();
  const recentLeads = leads.slice(0, 5);

  // Calculate stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newLeads = leads.filter((l) => l.created_at >= thirtyDaysAgo);
  const newCount = newLeads.filter((l) => l.status === "new").length;
  const contactedCount = newLeads.filter((l) => l.status === "contacted").length;
  const doneCount = newLeads.filter((l) => l.status === "done").length;

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const isAdmin = profile?.role === "admin";

  // Get websites for this user (or impersonated client)
  let websites: { id: string; name: string; url: string }[] = [];
  const supabase = await createClient();

  if (isAdmin) {
    // Check if impersonating
    const impersonatedClientId = await getImpersonatedClientId();
    if (impersonatedClientId) {
      const { data } = await supabase
        .from("websites")
        .select("id, name, url")
        .eq("client_id", impersonatedClientId)
        .eq("is_active", true);
      websites = data || [];
    }
  } else if (profile) {
    // For regular clients, get their websites via client_users
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", profile.id);

    if (clientUsers && clientUsers.length > 0) {
      const clientIds = clientUsers.map((cu) => cu.client_id);
      const { data } = await supabase
        .from("websites")
        .select("id, name, url")
        .in("client_id", clientIds)
        .eq("is_active", true);
      websites = data || [];
    }
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">
        {getGreeting()}, {firstName}
      </h1>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{formatNumber(newLeads.length)}</p>
            <p className="text-sm font-medium">Total Leads</p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{formatNumber(newCount)}</p>
            <p className="text-sm font-medium">New</p>
            <p className="text-xs text-muted-foreground">Awaiting contact</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{formatNumber(contactedCount)}</p>
            <p className="text-sm font-medium">Contacted</p>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{formatNumber(doneCount)}</p>
            <p className="text-sm font-medium">Done</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links - Your Websites */}
      {websites.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {websites.map((website) => (
                <a
                  key={website.id}
                  href={`${website.url.replace(/\/$/, "")}/wp-admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:bg-muted"
                >
                  <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.443 12c0-.735.097-1.447.277-2.128l3.04 8.327A8.574 8.574 0 0 1 3.443 12zm8.557 8.557c-.725 0-1.426-.09-2.098-.26l2.229-6.478 2.283 6.257a.726.726 0 0 0 .056.103 8.507 8.507 0 0 1-2.47.378zm1.001-12.593c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.73 0-1.958-.095-1.958-.095-.401-.023-.448.591-.047.614 0 0 .378.047.778.071l1.155 3.166-1.622 4.868L7.45 8.036c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.14 0-.305-.004-.478-.01A8.546 8.546 0 0 1 12 3.443c2.096 0 4.008.757 5.492 2.011-.035-.002-.069-.007-.105-.007-.73 0-1.246.636-1.246 1.317 0 .612.354 1.129.73 1.74.283.495.614 1.129.614 2.046 0 .636-.177 1.426-.518 2.39l-.68 2.27-2.459-7.317.002.001zm3.086 10.843l2.25-6.503c.42-1.052.56-1.893.56-2.641 0-.272-.018-.524-.05-.763a8.554 8.554 0 0 1 .711 3.1c0 2.551-1.134 4.835-2.921 6.393l-.55.414z"/>
                  </svg>
                  <div className="text-left">
                    <span className="text-sm font-medium">{website.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">WP Admin</span>
                  </div>
                  <svg className="ml-1 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Leads</CardTitle>
          {leads.length > 0 && (
            <Link href="/leads" className="text-sm font-medium hover:underline">
              View all
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leads yet. Leads will appear here when they come in via webhooks.
            </p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {lead.name || lead.email || lead.phone || "Unknown"}
                      </span>
                      <Badge
                        variant={
                          lead.status === "new"
                            ? "default"
                            : lead.status === "contacted"
                            ? "warning"
                            : "success"
                        }
                      >
                        {lead.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.website_name} • {timeAgo(lead.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
