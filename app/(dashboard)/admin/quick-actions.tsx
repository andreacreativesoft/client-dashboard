"use client";

import { Building2, ChevronRight, Eye, UserPlus } from "lucide-react";
import { useState } from "react";

import { ClientViewDialog } from "@/components/client-view-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Client } from "@/types/database";

import { ClientForm } from "./clients/client-form";
import { UserForm } from "./users/user-form";

interface QuickActionsProps {
    clients: Client[];
}

const actionTile =
    "group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function QuickActions({ clients }: QuickActionsProps) {
    const [clientFormOpen, setClientFormOpen] = useState(false);
    const [userFormOpen, setUserFormOpen] = useState(false);
    const [clientViewOpen, setClientViewOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {clients.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setClientViewOpen(true)}
                            className={actionTile}>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                                <Eye className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-base font-semibold text-foreground">
                                    Ouvrir un espace client
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    Voir le tableau de bord d'un client comme lui
                                </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setClientFormOpen(true)}
                        className={actionTile}>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                            <Building2 className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-foreground">
                                Nouveau client
                            </span>
                            <span className="block text-sm text-muted-foreground">
                                Créer un compte client et configurer ses sites
                            </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserFormOpen(true)}
                        className={actionTile}>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-soft text-orange">
                            <UserPlus className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-foreground">
                                Inviter un utilisateur
                            </span>
                            <span className="block text-sm text-muted-foreground">
                                Envoyer une invitation à un nouvel utilisateur
                            </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-orange" />
                    </button>
                </CardContent>
            </Card>

            <ClientForm open={clientFormOpen} onClose={() => setClientFormOpen(false)} />

            <UserForm
                open={userFormOpen}
                onClose={() => setUserFormOpen(false)}
                clients={clients}
            />

            <ClientViewDialog
                clients={clients}
                open={clientViewOpen}
                onClose={() => setClientViewOpen(false)}
            />
        </>
    );
}
