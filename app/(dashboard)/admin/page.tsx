import type { Metadata } from "next";
import Link from "next/link";

import { AlertsSummary, ClientAlerts } from "@/components/client-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getClientAlerts } from "@/lib/actions/alerts";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database";

import { QuickActions } from "./quick-actions";

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
    const [clientsResult, websitesResult, leadsResult, usersResult, clientsData, alerts] =
        await Promise.all([
            supabase.from("clients").select("id", { count: "exact", head: true }),
            supabase.from("websites").select("id", { count: "exact", head: true }),
            supabase
                .from("leads")
                .select("id", { count: "exact", head: true })
                .gte("created_at", thirtyDaysAgo),
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase
                .from("clients")
                .select("*")
                .order("business_name")
                .overrideTypes<Client[], { merge: false }>(),
            getClientAlerts(),
        ]);

    const stats = [
        {
            title: "Clients",
            value: clientsResult.count ?? 0,
            href: "/admin/clients",
        },
        {
            title: "Sites web",
            value: websitesResult.count ?? 0,
            href: "/admin/websites",
        },
        {
            title: "Prospects (30j)",
            value: leadsResult.count ?? 0,
            // Leads are client-scoped (admins view them via impersonation); drill into clients.
            href: "/admin/clients",
        },
        {
            title: "Utilisateurs",
            value: usersResult.count ?? 0,
            href: "/admin/users",
        },
    ];

    const clients = clientsData.data || [];

    return (
        <PageContainer>
            <PageTitle className="mb-6">Espace agence</PageTitle>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Link
                        key={stat.title}
                        href={stat.href}
                        className="flex flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-md">
                        <p
                            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                            {stat.value}
                        </p>
                        <p className="text-[16px] font-bold leading-[1.5] text-ink">{stat.title}</p>
                    </Link>
                ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <QuickActions clients={clients} />

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Alertes clients</CardTitle>
                            <AlertsSummary alerts={alerts} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ClientAlerts alerts={alerts} />
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}
