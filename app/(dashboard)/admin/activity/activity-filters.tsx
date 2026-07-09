"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ClientSelect } from "@/components/client-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Action type → human label (French, matching the admin pages' convention).
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
    submission_created: "Prospect reçu",
    submission_status_changed: "Statut prospect modifié",
    submission_note_added: "Note prospect ajoutée",
    connector_created: "Connecteur créé",
    connector_updated: "Connecteur modifié",
    connector_deleted: "Connecteur supprimé",
    ticket_created: "Demande créée",
    ticket_replied: "Réponse à une demande",
    ticket_status_changed: "Statut demande modifié",
    client_created: "Client créé",
    client_updated: "Client modifié",
    website_added: "Site ajouté",
    website_updated: "Site modifié",
    website_removed: "Site retiré",
    attribute_added: "Info/lien ajouté",
    attribute_updated: "Info/lien modifié",
    attribute_removed: "Info/lien retiré",
    user_invited: "Utilisateur invité",
    user_joined: "Utilisateur rejoint",
    user_assigned: "Utilisateur assigné",
    user_removed: "Utilisateur retiré",
    analytics_synced: "Analytics synchronisé",
    integration_connected: "Intégration connectée",
    integration_disconnected: "Intégration déconnectée",
    email_sent: "Email envoyé",
};

interface ActivityFiltersProps {
    clients: { id: string; business_name: string }[];
    currentClient: string;
    currentType: string;
}

export function ActivityFilters({ clients, currentClient, currentType }: ActivityFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    function navigate(params: Record<string, string | undefined>) {
        const next = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(params)) {
            if (!value || value === "all") next.delete(key);
            else next.set(key, value);
        }
        // Any filter change resets pagination.
        next.delete("page");
        const qs = next.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Client
                </span>
                <ClientSelect
                    clients={clients}
                    value={currentClient}
                    onValueChange={(v) => navigate({ client: v })}
                    allLabel="Tous les clients"
                    placeholder="Tous les clients"
                    triggerClassName="h-9 w-56 text-sm"
                />
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                </span>
                <Select value={currentType} onValueChange={(v) => navigate({ type: v })}>
                    <SelectTrigger className="h-9 w-64 text-sm">
                        <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
