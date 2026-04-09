import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { QuickActions } from "./quick-actions";
import { ClientAlerts } from "@/components/client-alerts";
import { getClientAlerts } from "@/lib/actions/alerts";
import type { Client } from "@/types/database";

function getThirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = getThirtyDaysAgo();

  // Fetch stats, clients for quick actions, and alerts
  const [clientsResult, websitesResult, leadsResult, usersResult, clientsData, alerts] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("websites").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("*").order("business_name").returns<Client[]>(),
    getClientAlerts(),
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
    <div className="px-8 py-12">
      <h1 className="mb-6 text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>Admin Panel</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href} className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-md">
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{stat.value}</p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{stat.title}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <QuickActions clients={clients} />

        <Card>
          <CardHeader>
            <CardTitle>Client Success Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientAlerts alerts={alerts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
