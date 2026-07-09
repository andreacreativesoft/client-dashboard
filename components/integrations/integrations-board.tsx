"use client";

import { Check, LineChart, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    getBindableAccountsForWebsite,
    type ConnectedAccountSummary,
} from "@/lib/actions/connected-accounts";
import {
    bindIntegration,
    deleteIntegration,
    getIntegrationsForWebsite,
} from "@/lib/actions/integrations";
import { cn } from "@/lib/utils";
import type { AnalyticsService, Integration } from "@/types/database";

type ServiceDef = {
    service: AnalyticsService;
    label: string;
    description: string;
    Icon: typeof LineChart;
    /** Teinte de la tuile d'icône (couleur produit Google approchée). */
    tint: string;
};

const SERVICES: ServiceDef[] = [
    {
        service: "ga4",
        label: "Google Analytics",
        description: "Fréquentation et comportement du site",
        Icon: LineChart,
        tint: "bg-orange-100 text-orange-600",
    },
    {
        service: "gbp",
        label: "Business Profile",
        description: "Fiche Google : appels, itinéraires, vues",
        Icon: Store,
        tint: "bg-blue-100 text-blue-600",
    },
    {
        service: "gsc",
        label: "Search Console",
        description: "Visibilité et requêtes sur Google",
        Icon: Search,
        tint: "bg-emerald-100 text-emerald-600",
    },
];

/** Une ressource liable, rattachée à son compte d'origine. */
type BindOption = {
    accountId: string;
    accountLabel: string;
    isGlobal: boolean;
    resourceId: string;
    resourceLabel: string;
};

/** Extrait les ressources disponibles d'un service depuis le metadata d'un compte. */
function resourceOptions(
    service: AnalyticsService,
    account: ConnectedAccountSummary,
): { id: string; label: string }[] {
    const m = account.metadata as Record<string, unknown>;
    if (service === "ga4") {
        const props = (m.ga4Properties as Array<Record<string, unknown>>) || [];
        return props.flatMap((acc) =>
            ((acc.propertySummaries as Array<Record<string, unknown>>) || []).map((p) => ({
                id: String(p.property || "").replace("properties/", ""),
                label: String(p.displayName || p.property || ""),
            })),
        );
    }
    if (service === "gbp") {
        const locs = (m.gbpLocations as Array<Record<string, unknown>>) || [];
        return locs.map((l) => ({
            id: String(l.locationId || ""),
            label: String(l.locationName || l.locationId || ""),
        }));
    }
    const sites = (m.gscSites as Array<Record<string, unknown>>) || [];
    return sites.map((s) => ({ id: String(s.siteUrl || ""), label: String(s.siteUrl || "") }));
}

/** Toutes les ressources d'un service, tous comptes confondus. */
function bindOptions(service: AnalyticsService, accounts: ConnectedAccountSummary[]): BindOption[] {
    return accounts.flatMap((a) =>
        resourceOptions(service, a).map((r) => ({
            accountId: a.id,
            accountLabel: a.label ?? "Google",
            isGlobal: a.isGlobal,
            resourceId: r.id,
            resourceLabel: r.label,
        })),
    );
}

const encodeOption = (o: BindOption) => `${o.accountId}::${o.resourceId}`;

// ─── Modal de sélection (recherche + filtre par compte) ────────────────

function BindResourceModal({
    serviceLabel,
    websiteId,
    service,
    options,
    currentResourceId,
    onClose,
    onBound,
}: {
    serviceLabel: string;
    websiteId: string;
    service: AnalyticsService;
    options: BindOption[];
    currentResourceId: string | null;
    onClose: () => void;
    onBound: () => void;
}) {
    const [query, setQuery] = useState("");
    const [accountFilter, setAccountFilter] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    // Comptes distincts présents dans les options (pour les puces de filtre).
    const accounts = useMemo(() => {
        const seen = new Map<string, { id: string; label: string; isGlobal: boolean }>();
        for (const o of options) {
            if (!seen.has(o.accountId)) {
                seen.set(o.accountId, {
                    id: o.accountId,
                    label: o.accountLabel,
                    isGlobal: o.isGlobal,
                });
            }
        }
        return [...seen.values()];
    }, [options]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return options.filter(
            (o) =>
                (!accountFilter || o.accountId === accountFilter) &&
                (q === "" ||
                    o.resourceLabel.toLowerCase().includes(q) ||
                    o.accountLabel.toLowerCase().includes(q)),
        );
    }, [options, query, accountFilter]);

    async function pick(o: BindOption) {
        setBusyId(encodeOption(o));
        const r = await bindIntegration({
            websiteId,
            accountId: o.accountId,
            service,
            resourceId: o.resourceId,
            resourceLabel: o.resourceLabel,
        });
        setBusyId(null);
        if (r.success) {
            toast.success("Ressource liée");
            onBound();
            onClose();
        } else toast.error(r.error || "Échec de la liaison");
    }

    return (
        <Modal open onClose={onClose} title={`Lier ${serviceLabel}`}>
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher une ressource…"
                        className="pl-9"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        Compte
                    </span>
                    <Select
                        value={accountFilter ?? "all"}
                        onValueChange={(v) => setAccountFilter(v === "all" ? null : v)}>
                        <SelectTrigger className="h-9 flex-1 text-sm">
                            <SelectValue placeholder="Tous les comptes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les comptes</SelectItem>
                            {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                    {a.label}
                                    {a.isGlobal ? " · global" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <ul className="max-h-[46vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {filtered.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Aucune ressource ne correspond.
                        </li>
                    ) : (
                        filtered.map((o) => {
                            const isCurrent = o.resourceId === currentResourceId;
                            const isBusy = busyId === encodeOption(o);
                            return (
                                <li key={encodeOption(o)}>
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => pick(o)}
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {o.resourceLabel}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {o.accountLabel}
                                                {o.isGlobal ? " · global" : ""}
                                            </p>
                                        </div>
                                        {isCurrent ? (
                                            <Badge variant="success" className="shrink-0 gap-1">
                                                <Check className="size-3" />
                                                Actuel
                                            </Badge>
                                        ) : (
                                            <span className="shrink-0 text-xs font-medium text-brand">
                                                {isBusy ? "…" : "Lier"}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </Modal>
    );
}

// ─── Carte de service ──────────────────────────────────────────────────

function ServiceCard({
    def,
    integration,
    options,
    accountLabelById,
    onLink,
    onChanged,
}: {
    def: ServiceDef;
    integration: Integration | undefined;
    options: BindOption[];
    accountLabelById: Map<string, string>;
    onLink: () => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const { Icon, label, description, tint } = def;
    const hasOptions = options.length > 0;
    const boundAccount = integration ? accountLabelById.get(integration.account_id) : null;

    async function handleUnbind() {
        if (!integration) return;
        setBusy(true);
        const r = await deleteIntegration(integration.id);
        if (r.success) onChanged();
        else {
            toast.error(r.error || "Échec");
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", tint)}>
                    <Icon className="size-5" />
                </div>
                {integration ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        Lié
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">Non lié</span>
                )}
            </div>

            <div className="min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 line-clamp-2 min-h-8 text-xs text-muted-foreground">
                    {integration
                        ? `${integration.resource_label || integration.resource_id}${
                              boundAccount ? ` · ${boundAccount}` : ""
                          }`
                        : description}
                </p>
            </div>

            <div className="mt-auto flex items-center gap-1.5">
                {integration ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={onLink}
                            disabled={!hasOptions}>
                            Modifier
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={handleUnbind}
                            className="text-muted-foreground hover:text-destructive">
                            Délier
                        </Button>
                    </>
                ) : hasOptions ? (
                    <Button size="sm" className="w-full" onClick={onLink}>
                        Lier
                    </Button>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        Aucune ressource disponible
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Board ─────────────────────────────────────────────────────────────

/**
 * Liaison ressource ↔ site pour les 3 services Google. Utilisé côté admin
 * (fiche client) et côté client (paramètres avancés). Les comptes liables sont
 * résolus au niveau du site (spécifiques + globaux pour l'admin, uniquement les
 * siens pour le client). « Lier / Modifier » ouvre une modal de recherche.
 */
export function IntegrationsBoard({
    websiteId,
    googleConfigured,
}: {
    websiteId: string;
    googleConfigured: boolean;
}) {
    const [accounts, setAccounts] = useState<ConnectedAccountSummary[]>([]);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalService, setModalService] = useState<AnalyticsService | null>(null);

    async function load() {
        const [accs, ints] = await Promise.all([
            getBindableAccountsForWebsite(websiteId),
            getIntegrationsForWebsite(websiteId),
        ]);
        setAccounts(accs);
        setIntegrations(ints);
        setLoading(false);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [websiteId]);

    const accountLabelById = useMemo(
        () => new Map(accounts.map((a) => [a.id, a.label ?? "Google"])),
        [accounts],
    );

    if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

    if (accounts.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                {googleConfigured
                    ? "Aucun compte Google connecté pour ce client. Connectez-en un pour lier ce site."
                    : "OAuth Google non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / TOKEN_ENCRYPTION_KEY)."}
            </p>
        );
    }

    const activeDef = SERVICES.find((s) => s.service === modalService) ?? null;
    const activeIntegration = integrations.find((i) => i.service === modalService);

    return (
        <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICES.map((def) => (
                    <ServiceCard
                        key={def.service}
                        def={def}
                        integration={integrations.find((i) => i.service === def.service)}
                        options={bindOptions(def.service, accounts)}
                        accountLabelById={accountLabelById}
                        onLink={() => setModalService(def.service)}
                        onChanged={load}
                    />
                ))}
            </div>

            {activeDef && (
                <BindResourceModal
                    key={activeDef.service}
                    serviceLabel={activeDef.label}
                    websiteId={websiteId}
                    service={activeDef.service}
                    options={bindOptions(activeDef.service, accounts)}
                    currentResourceId={activeIntegration?.resource_id ?? null}
                    onClose={() => setModalService(null)}
                    onBound={load}
                />
            )}
        </>
    );
}
