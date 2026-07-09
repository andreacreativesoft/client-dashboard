"use client";

import {
    AtSign,
    Bug,
    Eye,
    FilePlus2,
    Filter,
    type LucideIcon,
    MessageCircle,
    Palette,
    PencilLine,
    Receipt,
    Search,
    ServerCrash,
    Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ClientSelect } from "@/components/client-select";
import { Avatar } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-context";
import { getTicketType, tr } from "@/lib/tickets/ticket-types";
import { cn, formatDateTime, timeAgoIntl } from "@/lib/utils";
import type { TicketWithDetails, TicketStatus } from "@/types/database";

const TYPE_ICONS: Record<string, LucideIcon> = {
    PencilLine,
    Bug,
    ServerCrash,
    FilePlus2,
    Sparkles,
    Palette,
    Search,
    AtSign,
    Receipt,
    MessageCircle,
};

interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

interface TicketsListProps {
    tickets: TicketWithDetails[];
    isAdmin: boolean;
    pagination?: PaginationInfo;
    /** Base path for ticket links — "/tickets" (client) or "/admin/tickets" (agency). */
    basePath?: string;
    /** Admin tickets view: multi-select status + sort controls. */
    advanced?: boolean;
    /** Clients for the admin client filter (advanced view). */
    clients?: { id: string; business_name: string }[];
    /** Agency members for the assignee column + filter (advanced view). */
    assignableUsers?: { id: string; full_name: string }[];
}

const ALL_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_client", "closed"];
// Default admin view: everything that still needs attention (all but closed).
const DEFAULT_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_client"];

const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "recent", label: "Derniers créés" },
    { value: "updated", label: "Derniers modifiés" },
    { value: "waiting_longest", label: "En attente le plus longtemps" },
];

export function TicketsList({
    tickets,
    isAdmin,
    pagination,
    basePath = "/tickets",
    advanced = false,
    clients = [],
    assignableUsers = [],
}: TicketsListProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentSearch = searchParams.get("search") || "";
    const [search, setSearch] = useState(currentSearch);
    const [showFilters, setShowFilters] = useState(false);
    const { t, language } = useLanguage();

    const currentStatus = searchParams.get("status") || "all";
    const currentPriority = searchParams.get("priority") || "all";
    const currentSort = searchParams.get("sort") || "recent";
    const currentClient = searchParams.get("client") || "all";
    const currentAssignee = searchParams.get("assignee") || "all";
    const currentPage = pagination?.page ?? 1;

    // Advanced (admin) status filter is multi-select via a comma-separated param.
    const statusParam = searchParams.get("status");
    const selectedStatuses = statusParam
        ? (statusParam.split(",").filter(Boolean) as TicketStatus[])
        : DEFAULT_STATUSES;

    // Whether the empty state is due to filters/search (vs genuinely no tickets).
    const filtersActive =
        Boolean(currentSearch) ||
        currentPriority !== "all" ||
        currentClient !== "all" ||
        currentAssignee !== "all" ||
        statusParam !== null ||
        (!advanced && currentStatus !== "all");

    function toggleStatus(status: TicketStatus) {
        const next = selectedStatuses.includes(status)
            ? selectedStatuses.filter((s) => s !== status)
            : [...selectedStatuses, status];
        // Empty selection falls back to the default (never show an empty list by accident).
        navigateTo({ status: next.length ? next.join(",") : undefined, page: undefined });
    }

    function handleSort(sort: string) {
        navigateTo({ sort: sort === "recent" ? undefined : sort, page: undefined });
    }

    function handleClientFilter(client: string) {
        navigateTo({ client: client === "all" ? undefined : client, page: undefined });
    }

    function handleAssigneeFilter(assignee: string) {
        navigateTo({ assignee: assignee === "all" ? undefined : assignee, page: undefined });
    }

    function navigateTo(params: Record<string, string | undefined>) {
        const newParams = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === "all" || value === "1") {
                newParams.delete(key);
            } else {
                newParams.set(key, value);
            }
        }
        const qs = newParams.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    // Debounce the search box into the URL → runs server-side over the whole
    // dataset and resets to page 1, instead of filtering only the current page.
    useEffect(() => {
        const handle = setTimeout(() => {
            if (search.trim() !== currentSearch) {
                navigateTo({ search: search.trim() || undefined, page: undefined });
            }
        }, 350);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    function handleStatusFilter(status: string) {
        navigateTo({ status, page: undefined });
    }

    function handlePriorityFilter(priority: string) {
        navigateTo({ priority, page: undefined });
    }

    function handlePageChange(page: number) {
        navigateTo({ page: String(page) });
    }

    const statusLabel = (status: TicketStatus) => {
        switch (status) {
            case "open":
                return t("tickets.open");
            case "in_progress":
                return t("tickets.in_progress");
            case "waiting_on_client":
                return t("tickets.waiting_on_client");
            case "closed":
                return t("tickets.closed");
            default:
                return status;
        }
    };

    // Statut = tons froids/neutres (workflow, ne signale pas la gravité).
    const statusStyle = (status: TicketStatus) => {
        switch (status) {
            case "open":
                return "bg-slate-100 text-slate-700";
            case "in_progress":
                return "bg-blue-100 text-blue-700";
            case "waiting_on_client":
                return "bg-violet-100 text-violet-700";
            case "closed":
                return "bg-muted text-muted-foreground";
            default:
                return "bg-muted text-muted-foreground";
        }
    };

    const priorityLabel = (priority: string) => {
        switch (priority) {
            case "urgent":
                return t("tickets.priority_urgent");
            case "high":
                return t("tickets.priority_high");
            case "medium":
                return t("tickets.priority_medium");
            default:
                return t("tickets.priority_low");
        }
    };

    // Priorité = échelle de chaleur (gravité au coup d'œil) : neutre → ambre → orange → rouge.
    const priorityStyle = (priority: string) =>
        priority === "urgent"
            ? "bg-red-100 text-red-700"
            : priority === "high"
              ? "bg-orange-100 text-orange-700"
              : priority === "medium"
                ? "bg-amber-50 text-amber-700"
                : "bg-muted text-muted-foreground";

    return (
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
            {/* Header: search + filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="w-full sm:w-[384px]">
                    <div className="flex items-center gap-2 rounded-lg border border-brand-border bg-surface px-4 py-3">
                        <Search className="size-4 text-ink-muted" />
                        <input
                            type="text"
                            placeholder={t("tickets.search_placeholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent text-[14px] leading-[1.5] text-ink placeholder-ink-muted outline-none"
                        />
                    </div>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[14px] transition-colors ${
                        showFilters
                            ? "border-orange bg-orange-soft text-orange"
                            : "border-gray-200 bg-white text-ink hover:bg-surface"
                    }`}>
                    <Filter className="size-3" />
                    Filtres
                </button>
            </div>

            {/* Filter bar */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3">
                    {/* Status filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold uppercase tracking-[0.72px] text-ink-muted">
                            Statut :
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {advanced
                                ? ALL_STATUSES.map((s) => (
                                      <button
                                          key={s}
                                          onClick={() => toggleStatus(s)}
                                          className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] transition-colors ${
                                              selectedStatuses.includes(s)
                                                  ? "bg-orange text-white"
                                                  : "bg-line text-ink-muted hover:bg-brand-soft"
                                          }`}>
                                          {statusLabel(s)}
                                      </button>
                                  ))
                                : (
                                      [
                                          "all",
                                          "open",
                                          "in_progress",
                                          "waiting_on_client",
                                          "closed",
                                      ] as const
                                  ).map((s) => (
                                      <button
                                          key={s}
                                          onClick={() => handleStatusFilter(s)}
                                          className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] transition-colors ${
                                              currentStatus === s
                                                  ? "bg-orange text-white"
                                                  : "bg-line text-ink-muted hover:bg-brand-soft"
                                          }`}>
                                          {s === "all" ? t("tickets.all") : statusLabel(s)}
                                      </button>
                                  ))}
                        </div>
                    </div>

                    {/* Sort (admin) */}
                    {advanced && (
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold uppercase tracking-[0.72px] text-ink-muted">
                                Trier par :
                            </span>
                            <Select value={currentSort} onValueChange={handleSort}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Client filter (admin) */}
                    {advanced && clients.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold uppercase tracking-[0.72px] text-ink-muted">
                                Client :
                            </span>
                            <ClientSelect
                                clients={clients}
                                value={currentClient}
                                onValueChange={handleClientFilter}
                                allLabel="Tous les clients"
                                placeholder="Tous les clients"
                                triggerClassName="h-8 w-56 text-xs"
                            />
                        </div>
                    )}

                    {/* Assignee filter (admin) */}
                    {advanced && (
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold uppercase tracking-[0.72px] text-ink-muted">
                                Assigné :
                            </span>
                            <Select value={currentAssignee} onValueChange={handleAssigneeFilter}>
                                <SelectTrigger className="h-8 w-48 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous</SelectItem>
                                    <SelectItem value="unassigned">Non assigné</SelectItem>
                                    {assignableUsers.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Priority filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold uppercase tracking-[0.72px] text-ink-muted">
                            Priorité :
                        </span>
                        <div className="flex gap-1">
                            {(["all", "low", "medium", "high", "urgent"] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handlePriorityFilter(p)}
                                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] capitalize transition-colors ${
                                        currentPriority === p
                                            ? "bg-brand text-white"
                                            : "bg-line text-ink-muted hover:bg-brand-soft"
                                    }`}>
                                    {p === "all" ? t("tickets.all") : p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-line">
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                #
                            </th>
                            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("tickets.subject")}
                            </th>
                            {isAdmin && (
                                <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                    {t("tickets.client")}
                                </th>
                            )}
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                État
                            </th>
                            {isAdmin && (
                                <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                    Assigné
                                </th>
                            )}
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                Date
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isAdmin ? 7 : 5}
                                    className="px-4 py-12 text-center text-[14px] text-ink-muted">
                                    {filtersActive
                                        ? t("tickets.no_matching")
                                        : t("tickets.no_tickets")}
                                </td>
                            </tr>
                        ) : (
                            tickets.map((ticket) => (
                                <tr key={ticket.id} className="border-b border-line">
                                    <td className="px-4 py-4 text-center">
                                        <span className="text-[14px] font-bold tabular-nums text-ink-muted">
                                            #{ticket.number}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <Link
                                            href={`${basePath}/${ticket.id}`}
                                            className="group block">
                                            {/* Puce de type (icône + libellé, langue du lecteur) */}
                                            {(() => {
                                                const rt = getTicketType(ticket.type);
                                                if (!rt) return null;
                                                const Icon = TYPE_ICONS[rt.icon] ?? MessageCircle;
                                                return (
                                                    <span
                                                        className={cn(
                                                            "mb-1 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                                                            rt.accent,
                                                        )}>
                                                        <Icon className="size-3" />
                                                        {tr(rt.label, language)}
                                                    </span>
                                                );
                                            })()}
                                            <span className="block text-[14px] font-medium leading-[1.4] text-ink group-hover:underline">
                                                {ticket.subject}
                                            </span>
                                        </Link>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-4 py-4 text-center text-[14px]">
                                            <span className="block text-ink">
                                                {ticket.client_name}
                                            </span>
                                            <span className="block text-[12px] leading-[1.5] text-ink-muted">
                                                {ticket.created_by_name}
                                            </span>
                                        </td>
                                    )}
                                    {/* Cellule riche « État » : statut + priorité empilés */}
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <span
                                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] ${statusStyle(ticket.status)}`}>
                                                {statusLabel(ticket.status)}
                                            </span>
                                            <span
                                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] ${priorityStyle(ticket.priority)}`}>
                                                {priorityLabel(ticket.priority)}
                                            </span>
                                        </div>
                                    </td>
                                    {/* Avatar de l'assigné (ou tiret si non assigné) */}
                                    {isAdmin && (
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center">
                                                {ticket.assigned_to_name ? (
                                                    <span title={ticket.assigned_to_name}>
                                                        <Avatar
                                                            name={ticket.assigned_to_name}
                                                            src={ticket.assigned_to_avatar}
                                                            size="sm"
                                                        />
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="text-[14px] text-ink-muted"
                                                        title="Non assigné">
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-4 py-4 text-center text-[14px] text-ink-muted">
                                        <span
                                            suppressHydrationWarning
                                            title={formatDateTime(ticket.created_at)}>
                                            {timeAgoIntl(ticket.created_at)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <Link
                                            href={`${basePath}/${ticket.id}`}
                                            className="text-ink-muted transition-colors hover:text-brand"
                                            title={t("tickets.view")}>
                                            <Eye className="mx-auto size-4" />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4">
                    <p className="text-[14px] text-ink-muted">
                        {t("leads.showing")}{" "}
                        <span className="font-bold text-ink">
                            {(currentPage - 1) * pagination.perPage + 1}-
                            {Math.min(currentPage * pagination.perPage, pagination.total)}
                        </span>{" "}
                        {t("leads.of")}{" "}
                        <span className="font-bold text-ink">{pagination.total}</span>
                    </p>
                    <div className="flex overflow-hidden rounded border border-line">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(1)}
                            className="flex h-8 items-center justify-center bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &laquo;
                        </button>
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &lsaquo;
                        </button>
                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                            let pageNum: number;
                            if (pagination.totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= pagination.totalPages - 2)
                                pageNum = pagination.totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`flex h-8 items-center justify-center border-l border-line px-3 text-[14px] ${pageNum === currentPage ? "bg-orange text-white" : "bg-white text-ink-muted hover:bg-surface"}`}>
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &rsaquo;
                        </button>
                        <button
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => handlePageChange(pagination.totalPages)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &raquo;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
