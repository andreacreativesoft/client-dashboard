"use client";

import {
    Activity,
    BarChart3,
    ExternalLink,
    Globe,
    Inbox,
    KeyRound,
    Lock,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { IntegrationsBoard } from "@/components/integrations/integrations-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteWebsiteAction } from "@/lib/actions/websites";
import { cn, formatDate } from "@/lib/utils";
import type { Website } from "@/types/database";

import { AttributesBoard } from "./attributes-board";
import { ConnectorsBoard } from "./connectors-board";
import { WebsiteForm } from "./website-form";

interface WebsitesListProps {
    clientId: string;
    websites: Website[];
    googleConfigured: boolean;
}

// Raw platform enum → human label (never surface the enum value in the UI).
const PLATFORM_LABELS: Record<string, string> = {
    wordpress: "WordPress",
    custom: "Sur-mesure",
};

// In-page sub-navigation: one area visible at a time (no stacked dividers).
type SectionId = "collect" | "analytics" | "uptime" | "info";
const SECTIONS: { id: SectionId; label: string; icon: typeof Inbox; hint: string }[] = [
    {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        hint: "Connexions Google Analytics, Business Profile et Search Console.",
    },
    {
        id: "collect",
        label: "Collecte",
        icon: Inbox,
        hint: "Portes de réception des prospects et formulaires.",
    },
    {
        id: "uptime",
        label: "Uptime",
        icon: Activity,
        hint: "Disponibilité, temps de réponse et incidents du site.",
    },
    {
        id: "info",
        label: "Infos & accès",
        icon: KeyRound,
        hint: "Identifiants, liens et notes techniques du site.",
    },
];

/** Bare hostname for the address bar (no protocol / www / trailing slash). */
function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
}

/** HTTPS drives the padlock vs globe in the address bar. */
function isSecure(url: string): boolean {
    try {
        return new URL(url).protocol === "https:";
    } catch {
        return false;
    }
}

export function WebsitesList({ clientId, websites, googleConfigured }: WebsitesListProps) {
    const searchParams = useSearchParams();
    const confirm = useConfirm();
    const [formOpen, setFormOpen] = useState(false);
    const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
    const [activeWebsiteId, setActiveWebsiteId] = useState<string | null>(null);
    const [section, setSection] = useState<SectionId>("analytics");

    // Active tab: user click wins, else the ?site= deep-link, else the first site.
    const siteParam = searchParams.get("site");
    const exists = (id: string | null) => !!id && websites.some((w) => w.id === id);
    const activeId = exists(activeWebsiteId)
        ? activeWebsiteId
        : exists(siteParam)
          ? siteParam
          : (websites[0]?.id ?? null);
    const active = websites.find((w) => w.id === activeId) ?? null;

    function handleEdit(website: Website) {
        setEditingWebsite(website);
        setFormOpen(true);
    }

    function handleClose() {
        setFormOpen(false);
        setEditingWebsite(null);
    }

    async function handleDelete(website: Website) {
        const ok = await confirm({
            title: `Supprimer « ${website.name} » ?`,
            description: "Cela supprimera aussi les connecteurs et soumissions de ce site.",
            confirmLabel: "Supprimer",
            destructive: true,
        });
        if (!ok) return;

        const result = await deleteWebsiteAction(website.id);
        if (!result.success) toast.error(result.error || "Échec de la suppression du site");
        else toast.success("Site supprimé");
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Sites web</h2>
                <span className="text-xs text-muted-foreground">
                    {websites.length} {websites.length === 1 ? "site" : "sites"}
                </span>
            </div>

            {websites.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                    <Globe className="size-8 text-muted-foreground" />
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Aucun site pour le moment. Ajoutez-en un pour commencer à recevoir des
                        soumissions.
                    </p>
                    <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
                        <Plus className="size-4" />
                        Ajouter un site
                    </Button>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    {/* ── Browser tab strip: one tab per website ── */}
                    <div className="flex items-end gap-1 overflow-x-auto overflow-y-hidden border-b border-border bg-muted/40 px-2 pt-2">
                        {websites.map((w) => {
                            const isActive = w.id === activeId;
                            return (
                                <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => setActiveWebsiteId(w.id)}
                                    title={w.name}
                                    className={cn(
                                        "-mb-px flex max-w-[180px] shrink-0 items-center gap-2 rounded-t-lg border px-3 py-2 text-sm transition-colors",
                                        isActive
                                            ? "border-border border-b-background bg-background font-medium text-foreground"
                                            : "border-transparent text-muted-foreground hover:bg-muted/70",
                                    )}>
                                    <span
                                        className={cn(
                                            "size-2 shrink-0 rounded-full",
                                            w.is_active ? "bg-success" : "bg-muted-foreground/40",
                                        )}
                                    />
                                    <span className="truncate">{w.name}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => setFormOpen(true)}
                            title="Ajouter un site"
                            aria-label="Ajouter un site"
                            className="mb-1.5 ml-0.5 shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <Plus className="size-4" />
                        </button>
                    </div>

                    {active && (
                        <>
                            {/* ── Address bar: macOS dots + URL pill + actions ── */}
                            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
                                <span className="flex shrink-0 gap-1.5" aria-hidden>
                                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                                </span>
                                <a
                                    href={active.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={active.url}
                                    className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted">
                                    {isSecure(active.url) ? (
                                        <Lock className="size-3 shrink-0 text-success" />
                                    ) : (
                                        <Globe className="size-3 shrink-0 text-muted-foreground" />
                                    )}
                                    <span className="truncate text-foreground">
                                        {hostOf(active.url)}
                                    </span>
                                    <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                </a>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0 gap-1.5">
                                            <Pencil className="size-3.5" />
                                            Gérer
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(active)}>
                                            <Pencil className="size-4" />
                                            Modifier le site
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => handleDelete(active)}>
                                            <Trash2 className="size-4" />
                                            Supprimer le site
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* ── Page content for the active site ── */}
                            <div className="space-y-6 p-5">
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-semibold">{active.name}</h3>
                                        <Badge variant={active.is_active ? "default" : "secondary"}>
                                            {active.is_active ? "Actif" : "Inactif"}
                                        </Badge>
                                        <Badge variant="outline">
                                            {PLATFORM_LABELS[active.platform] ?? active.platform}
                                        </Badge>
                                        {active.uptime_enabled && (
                                            <Badge variant="outline" className="gap-1">
                                                <Activity className="size-3" />
                                                Surveillance
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Ajouté le {formatDate(active.created_at)}
                                    </p>
                                </div>

                                {/* In-page sub-navigation — one area at a time. */}
                                <div className="space-y-3">
                                    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                                        {SECTIONS.map((s) => {
                                            const Icon = s.icon;
                                            const selected = section === s.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setSection(s.id)}
                                                    className={cn(
                                                        "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                                                        selected
                                                            ? "bg-background font-medium text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground",
                                                    )}>
                                                    <Icon className="size-3.5" />
                                                    {s.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {SECTIONS.find((s) => s.id === section)?.hint}
                                    </p>

                                    {section === "collect" && (
                                        <ConnectorsBoard
                                            websiteId={active.id}
                                            clientId={clientId}
                                        />
                                    )}
                                    {section === "analytics" && (
                                        <IntegrationsBoard
                                            websiteId={active.id}
                                            googleConfigured={googleConfigured}
                                        />
                                    )}
                                    {section === "uptime" && (
                                        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
                                            <Activity className="size-6 text-muted-foreground" />
                                            <p className="text-sm font-medium">
                                                Surveillance uptime
                                            </p>
                                            <p className="max-w-xs text-xs text-muted-foreground">
                                                Fonctionnalité en cours de développement.
                                            </p>
                                        </div>
                                    )}
                                    {section === "info" && (
                                        <AttributesBoard websiteId={active.id} />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <WebsiteForm
                open={formOpen}
                onClose={handleClose}
                clientId={clientId}
                website={editingWebsite}
            />
        </section>
    );
}
