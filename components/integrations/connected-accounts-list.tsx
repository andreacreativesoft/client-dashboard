"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { disconnectAccount, type ConnectedAccountSummary } from "@/lib/actions/connected-accounts";

/** Nombre de ressources exposées par un compte (pour le résumé). */
function resourceCounts(metadata: Record<string, unknown>): string {
    const ga4 = ((metadata.ga4Properties as unknown[]) || []).length;
    const gbp = ((metadata.gbpLocations as unknown[]) || []).length;
    const gsc = ((metadata.gscSites as unknown[]) || []).length;
    return `GA4 ${ga4} · GBP ${gbp} · GSC ${gsc}`;
}

export function ConnectedAccountsList({
    accounts,
    showOwner,
    emptyLabel,
}: {
    accounts: ConnectedAccountSummary[];
    /** Affiche le périmètre (Global / nom du client) — utile côté admin. */
    showOwner: boolean;
    emptyLabel: string;
}) {
    const confirm = useConfirm();
    const router = useRouter();
    const [busyId, setBusyId] = useState<string | null>(null);

    async function handleDisconnect(account: ConnectedAccountSummary) {
        const ok = await confirm({
            title: "Déconnecter ce compte ?",
            description:
                "Les liaisons de sites utilisant ce compte seront supprimées. Cette action est irréversible.",
            confirmLabel: "Déconnecter",
            destructive: true,
        });
        if (!ok) return;

        setBusyId(account.id);
        const r = await disconnectAccount(account.id);
        setBusyId(null);
        if (r.success) {
            toast.success("Compte déconnecté");
            router.refresh();
        } else toast.error(r.error || "Échec");
    }

    if (accounts.length === 0) {
        return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    return (
        <ul className="divide-y divide-border rounded-lg border border-border">
            {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">
                                {a.label || "Google"}
                            </span>
                            {showOwner && (
                                <Badge variant={a.isGlobal ? "default" : "secondary"}>
                                    {a.isGlobal ? "Global (agence)" : a.clientName || "Client"}
                                </Badge>
                            )}
                            {a.missingScopes.length > 0 && (
                                <Badge variant="warning" className="gap-1">
                                    <AlertTriangle className="size-3" />
                                    Scopes insuffisants
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {resourceCounts(a.metadata)}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === a.id}
                        onClick={() => handleDisconnect(a)}>
                        Déconnecter
                    </Button>
                </li>
            ))}
        </ul>
    );
}
