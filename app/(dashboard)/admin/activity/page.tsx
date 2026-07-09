import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActivityLog } from "@/components/activity-log";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getActivityPaginated } from "@/lib/actions/activity";
import { getClientsForTickets } from "@/lib/actions/tickets";

import { ACTIVITY_TYPE_LABELS, ActivityFilters } from "./activity-filters";

export const metadata: Metadata = {
    title: "Activité — Admin",
};

interface PageProps {
    searchParams: Promise<{ client?: string; type?: string; page?: string }>;
}

export default async function AdminActivityPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const clientId = params.client && params.client !== "all" ? params.client : undefined;
    const actionType =
        params.type && params.type !== "all" && params.type in ACTIVITY_TYPE_LABELS
            ? params.type
            : undefined;

    const [feed, clients] = await Promise.all([
        getActivityPaginated({ clientId, actionType }, page),
        getClientsForTickets(),
    ]);

    const buildHref = (targetPage: number) => {
        const qs = new URLSearchParams();
        if (clientId) qs.set("client", clientId);
        if (actionType) qs.set("type", actionType);
        if (targetPage > 1) qs.set("page", String(targetPage));
        const s = qs.toString();
        return s ? `/admin/activity?${s}` : "/admin/activity";
    };

    const from = feed.total === 0 ? 0 : (feed.page - 1) * feed.perPage + 1;
    const to = Math.min(feed.page * feed.perPage, feed.total);

    return (
        <PageContainer>
            <div className="mb-6">
                <Link
                    href="/admin/clients"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
                    <ArrowLeft className="h-4 w-4" />
                    Retour aux clients
                </Link>
            </div>

            <div className="mb-6 flex flex-col gap-1">
                <PageTitle>Activité</PageTitle>
                <PageSubtitle>
                    Journal chronologique de toute l'activité de l'application.
                </PageSubtitle>
            </div>

            <Card>
                <CardContent className="space-y-5 pt-6">
                    <ActivityFilters
                        clients={clients}
                        currentClient={clientId ?? "all"}
                        currentType={actionType ?? "all"}
                    />

                    <ActivityLog activities={feed.activities} showClient />

                    {feed.total > 0 && (
                        <div className="flex items-center justify-between border-t border-border pt-4">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">
                                    {from}–{to}
                                </span>{" "}
                                sur{" "}
                                <span className="font-medium text-foreground">{feed.total}</span>
                            </p>
                            <div className="flex gap-2">
                                {feed.page > 1 && (
                                    <Link
                                        href={buildHref(feed.page - 1)}
                                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
                                        Précédent
                                    </Link>
                                )}
                                {feed.page < feed.totalPages && (
                                    <Link
                                        href={buildHref(feed.page + 1)}
                                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
                                        Suivant
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
