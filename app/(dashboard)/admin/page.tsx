import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { QuickActions } from "./quick-actions";
import type { Client } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const supabase = await createClient();

  // Fetch stats and clients for quick actions
  const [clientsResult, websitesResult, leadsResult, usersResult, clientsData] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("websites").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("*").order("business_name").returns<Client[]>(),
  ]);

  const stats = [
    {
      title: "Total Clients",
      value: clientsResult.count ?? 0,
      href: "/admin/clients",
    },
    {
      title: "Total Websites",
      value: websitesResult.count ?? 0,
      href: "/admin/websites",
    },
    {
      title: "Leads (30d)",
      value: leadsResult.count ?? 0,
      href: "/leads",
    },
    {
      title: "Users",
      value: usersResult.count ?? 0,
      href: "/admin/users",
    },
  ];

  const clients = clientsData.data || [];

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <QuickActions clients={clients} />

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed will be added in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
