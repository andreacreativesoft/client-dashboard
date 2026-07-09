import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityLog } from "@/components/activity-log";
import { ConnectedAccountsList } from "@/components/integrations/connected-accounts-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getClientActivity } from "@/lib/actions/activity";
import { getClient } from "@/lib/actions/clients";
import { getConnectedAccountsForClient } from "@/lib/actions/connected-accounts";
import { getSubmissionCountForClient } from "@/lib/actions/submissions";
import { getLatestOpenTicketForClient, getTicketCountForClient } from "@/lib/actions/tickets";
import { getUsersForClient } from "@/lib/actions/users";
import { getWebsitesForClient } from "@/lib/actions/websites";
import { formatDate } from "@/lib/utils";

import { AdminNotes } from "./admin-notes";
import { ContactInfo } from "./contact-info";
import { WebsitesList } from "./websites-list";

export const metadata: Metadata = {
    title: "Fiche client",
};

const roleLabel = (role: string) => (role === "admin" ? "Administrateur" : "Client");
const accessLabel = (access: string) => (access === "owner" ? "Propriétaire" : "Lecteur");

const TICKET_STATUS_LABEL: Record<string, string> = {
    open: "Ouvert",
    in_progress: "En cours",
    waiting_on_client: "En attente client",
    closed: "Fermé",
};
// Statut = froid/neutre · Priorité = échelle de chaleur (gravité). Cohérent app.
const TICKET_STATUS_BADGE: Record<string, string> = {
    open: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    waiting_on_client: "bg-violet-100 text-violet-700",
    closed: "bg-muted text-muted-foreground",
};
const TICKET_PRIORITY_LABEL: Record<string, string> = {
    low: "Basse",
    medium: "Moyenne",
    high: "Haute",
    urgent: "Urgente",
};
const TICKET_PRIORITY_BADGE: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-amber-50 text-amber-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
};
const badgeBase =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
    const { id } = await params;
    const [
        client,
        websites,
        activities,
        leadCount,
        users,
        latestTicket,
        ticketCount,
        googleAccounts,
    ] = await Promise.all([
        getClient(id),
        getWebsitesForClient(id),
        getClientActivity(id, 3),
        getSubmissionCountForClient(id),
        getUsersForClient(id),
        getLatestOpenTicketForClient(id),
        getTicketCountForClient(id),
        getConnectedAccountsForClient(id),
    ]);

    const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    if (!client) {
        notFound();
    }

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

            <div className="mb-6 flex items-start justify-between">
                <div>
                    <PageTitle>{client.business_name}</PageTitle>
                    <p className="text-sm text-muted-foreground">
                        Créé le {formatDate(client.created_at)}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <WebsitesList
                        clientId={client.id}
                        websites={websites}
                        googleConfigured={googleConfigured}
                    />
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dernier ticket ouvert</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {latestTicket ? (
                                <Link
                                    href={`/admin/tickets/${latestTicket.id}`}
                                    className="block space-y-2 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                                    {/* Line 1: number + title (truncated). */}
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                            #{latestTicket.number}
                                        </span>
                                        <span className="truncate text-sm font-medium">
                                            {latestTicket.subject}
                                        </span>
                                    </div>
                                    {/* Line 2: priority + status badges. */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                            className={`${badgeBase} ${
                                                TICKET_PRIORITY_BADGE[latestTicket.priority] ??
                                                "bg-muted text-muted-foreground"
                                            }`}>
                                            {TICKET_PRIORITY_LABEL[latestTicket.priority] ??
                                                latestTicket.priority}
                                        </span>
                                        <span
                                            className={`${badgeBase} ${
                                                TICKET_STATUS_BADGE[latestTicket.status] ??
                                                "bg-muted text-muted-foreground"
                                            }`}>
                                            {TICKET_STATUS_LABEL[latestTicket.status] ??
                                                latestTicket.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Dernière interaction le{" "}
                                        {formatDate(latestTicket.updated_at)}
                                    </p>
                                </Link>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Aucun ticket ouvert pour ce client.
                                </p>
                            )}
                            <Link
                                href={`/admin/tickets?client=${client.id}`}
                                className="inline-block text-sm font-medium text-brand hover:underline">
                                Tous les tickets →
                            </Link>
                        </CardContent>
                    </Card>

                    <ContactInfo
                        clientId={client.id}
                        contactEmail={client.contact_email}
                        contactPhone={client.contact_phone}
                    />

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <CardTitle>Compte Google</CardTitle>
                            {googleConfigured && (
                                <Button asChild variant="outline" size="sm">
                                    <a href={`/api/auth/google?client_id=${client.id}`}>
                                        {googleAccounts.length > 0 ? "Ajouter" : "Connecter"}
                                    </a>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ConnectedAccountsList
                                accounts={googleAccounts}
                                showOwner={false}
                                emptyLabel="Aucun compte Google connecté. Connectez-en un pour relier les sites de ce client (Analytics, Business Profile, Search Console)."
                            />
                            {!googleConfigured && (
                                <p className="text-xs text-muted-foreground">
                                    OAuth Google non configuré côté serveur.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Utilisateurs assignés</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {users.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Aucun utilisateur assigné à ce client.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {users.map((u) => (
                                        <li
                                            key={u.id}
                                            className="flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <Avatar name={u.full_name || u.email} size="sm" />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">
                                                        {u.full_name || u.email}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {u.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <Badge
                                                    variant={
                                                        u.role === "admin" ? "default" : "secondary"
                                                    }>
                                                    {roleLabel(u.role)}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {accessLabel(u.access_role)}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Link
                                href="/admin/users"
                                className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
                                Gérer les utilisateurs →
                            </Link>
                        </CardContent>
                    </Card>

                    <AdminNotes clientId={client.id} initialNotes={client.notes} />

                    <Card>
                        <CardHeader>
                            <CardTitle>Statistiques</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Sites web</span>
                                <span className="font-medium">{websites.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Total prospects
                                </span>
                                <span className="font-medium">{leadCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Demandes</span>
                                <span className="font-medium">{ticketCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Utilisateurs</span>
                                <span className="font-medium">{users.length}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-sm text-muted-foreground">Client depuis</span>
                                <span className="font-medium">{formatDate(client.created_at)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Activité</CardTitle>
                            <Link
                                href={`/admin/activity?client=${client.id}`}
                                className="text-sm font-medium text-brand hover:underline">
                                Voir plus →
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <ActivityLog activities={activities} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageContainer>
    );
}
