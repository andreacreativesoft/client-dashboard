"use client";

import { ClipboardList, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ListToolbar } from "@/components/admin/list-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTitle } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { deleteClientAction, type ClientWithWebsites } from "@/lib/actions/clients";
import type { Client } from "@/types/database";

import { WebsiteForm } from "./[id]/website-form";
import { ClientForm } from "./client-form";

const PER_PAGE = 10;

interface ClientsListProps {
    clients: ClientWithWebsites[];
}

export function ClientsList({ clients }: ClientsListProps) {
    const confirm = useConfirm();
    const [formOpen, setFormOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [websiteFormClientId, setWebsiteFormClientId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return clients;
        return clients.filter((c) =>
            [c.business_name, c.contact_email, c.contact_phone, c.notes]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(q)),
        );
    }, [clients, search]);

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    function handleSearchChange(v: string) {
        setSearch(v);
        setPage(1);
    }

    function handleEdit(client: Client) {
        setEditingClient(client);
        setFormOpen(true);
    }

    function handleClose() {
        setFormOpen(false);
        setEditingClient(null);
    }

    async function handleDelete(client: Client) {
        const ok = await confirm({
            title: `Supprimer "${client.business_name}" ?`,
            description: "Cette action est irréversible.",
            confirmLabel: "Supprimer",
            destructive: true,
        });
        if (!ok) return;

        setDeletingId(client.id);
        const result = await deleteClientAction(client.id);
        setDeletingId(null);

        if (!result.success) {
            toast.error(result.error || "Échec de la suppression");
        } else {
            toast.success("Client supprimé");
        }
    }

    return (
        <>
            <div className="mb-6">
                <PageTitle>Clients</PageTitle>
            </div>

            <ListToolbar
                count={total}
                countLabel={total === 1 ? "client" : "clients"}
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Rechercher par nom, email, téléphone, note…"
                actionLabel="Ajouter un client"
                onAction={() => setFormOpen(true)}
            />

            {total === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">
                            {search
                                ? "Aucun client ne correspond à la recherche."
                                : "Aucun client pour le moment."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4">
                        {paged.map((client) => (
                            <Card key={client.id}>
                                <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <Avatar name={client.business_name} size="lg" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    href={`/admin/clients/${client.id}`}
                                                    className="text-base font-semibold text-foreground hover:underline">
                                                    {client.business_name}
                                                </Link>
                                                {client.notes && (
                                                    <div className="group relative">
                                                        <ClipboardList className="h-4 w-4 cursor-help text-muted-foreground" />
                                                        <div className="pointer-events-none absolute left-0 top-6 z-50 hidden w-64 rounded-lg border border-border bg-card p-3 text-sm shadow-lg group-hover:block">
                                                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                                                                Notes internes
                                                            </p>
                                                            <p className="whitespace-pre-wrap text-foreground">
                                                                {client.notes}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {(client.contact_email || client.contact_phone) && (
                                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                    {client.contact_email && (
                                                        <span>{client.contact_email}</span>
                                                    )}
                                                    {client.contact_phone && (
                                                        <span>{client.contact_phone}</span>
                                                    )}
                                                </div>
                                            )}
                                            {client.websites.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {client.websites.map((site) => (
                                                        <Link
                                                            key={site.id}
                                                            href={`/admin/clients/${client.id}?site=${site.id}`}
                                                            className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft">
                                                            {site.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Actions client"
                                                disabled={deletingId === client.id}>
                                                <MoreVertical className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/clients/${client.id}`}>
                                                    <Pencil className="size-4" />
                                                    Détails
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setWebsiteFormClientId(client.id)}>
                                                <Plus className="size-4" />
                                                Ajouter un site
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                                                <Pencil className="size-4" />
                                                Éditer
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={() => handleDelete(client)}>
                                                <Trash2 className="size-4" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Pagination
                        page={page}
                        perPage={PER_PAGE}
                        total={total}
                        onPageChange={setPage}
                    />
                </>
            )}

            <ClientForm open={formOpen} onClose={handleClose} client={editingClient} />

            {websiteFormClientId && (
                <WebsiteForm
                    open={true}
                    onClose={() => setWebsiteFormClientId(null)}
                    clientId={websiteFormClientId}
                />
            )}
        </>
    );
}
