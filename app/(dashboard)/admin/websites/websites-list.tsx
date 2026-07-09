"use client";

import { ExternalLink, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FilterSelect, ListToolbar } from "@/components/admin/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import type { Website, Client } from "@/types/database";

const PER_PAGE = 12;

type StatusFilter = "all" | "active" | "inactive";

export type WebsiteWithClient = Website & {
    client: Pick<Client, "id" | "business_name"> | null;
};

interface WebsitesListProps {
    websites: WebsiteWithClient[];
}

/** Bare hostname for the address bar (no protocol / www). */
function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

/** Whether the site is served over HTTPS (drives the padlock icon). */
function isSecure(url: string): boolean {
    try {
        return new URL(url).protocol === "https:";
    } catch {
        return false;
    }
}

export function WebsitesList({ websites }: WebsitesListProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return websites.filter((w) => {
            if (statusFilter === "active" && !w.is_active) return false;
            if (statusFilter === "inactive" && w.is_active) return false;
            if (!q) return true;
            return [w.name, w.url, w.platform, w.client?.business_name]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(q));
        });
    }, [websites, search, statusFilter]);

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    function handleSearchChange(v: string) {
        setSearch(v);
        setPage(1);
    }

    return (
        <>
            <div className="mb-6">
                <PageTitle>Sites web</PageTitle>
            </div>

            <ListToolbar
                count={total}
                countLabel={total === 1 ? "site" : "sites"}
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Rechercher par nom, URL, plateforme, client…"
                filters={
                    <FilterSelect
                        value={statusFilter}
                        onChange={(v) => {
                            setStatusFilter(v as StatusFilter);
                            setPage(1);
                        }}
                        options={[
                            { value: "all", label: "Tous les statuts" },
                            { value: "active", label: "Actifs" },
                            { value: "inactive", label: "Inactifs" },
                        ]}
                    />
                }
            />

            {total === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">
                            {search || statusFilter !== "all"
                                ? "Aucun site ne correspond aux filtres."
                                : "Aucun site pour le moment. Ajoutez d'abord un client puis ses sites."}
                        </p>
                        {!search && statusFilter === "all" && (
                            <Link
                                href="/admin/clients"
                                className="mt-4 inline-block text-sm font-medium underline">
                                Aller aux clients
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {paged.map((website) => {
                            return (
                                <Card
                                    key={website.id}
                                    className="flex h-full flex-col overflow-hidden">
                                    {/* Browser-chrome header: evokes the live site, no external dep */}
                                    <a
                                        href={website.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={website.url}
                                        className="group flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted">
                                        <span className="flex shrink-0 gap-1.5" aria-hidden>
                                            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                                            <span className="size-2.5 rounded-full bg-[#febc2e]" />
                                            <span className="size-2.5 rounded-full bg-[#28c840]" />
                                        </span>
                                        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                                            {isSecure(website.url) ? (
                                                <Lock className="size-3 shrink-0 text-success" />
                                            ) : (
                                                <Globe className="size-3 shrink-0" />
                                            )}
                                            <span className="truncate">{hostOf(website.url)}</span>
                                            <ExternalLink className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                                        </span>
                                    </a>

                                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="min-w-0 flex-1 truncate text-base font-semibold">
                                                    {website.name}
                                                </span>
                                                <Badge
                                                    variant={
                                                        website.is_active ? "default" : "secondary"
                                                    }
                                                    className="shrink-0">
                                                    {website.is_active ? "Actif" : "Inactif"}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span>Plateforme : {website.platform}</span>
                                                {website.client && (
                                                    <Link
                                                        href={`/admin/clients/${website.client.id}`}
                                                        className="hover:underline">
                                                        {website.client.business_name}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-auto flex gap-2 pt-1">
                                            <Link
                                                href={`/admin/clients/${website.client_id}?site=${website.id}`}
                                                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
                                                Gérer le site
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Pagination
                        page={page}
                        perPage={PER_PAGE}
                        total={total}
                        onPageChange={setPage}
                    />
                </>
            )}
        </>
    );
}
