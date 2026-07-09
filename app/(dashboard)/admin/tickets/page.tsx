import { CheckCircle2, Clock, Inbox, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TicketsList } from "@/components/tickets/tickets-list";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import {
    getAdminUsers,
    getClientsForTickets,
    getTicketsPaginated,
    type TicketSort,
} from "@/lib/actions/tickets";
import { t } from "@/lib/i18n/translations";
import type { TicketStatus } from "@/types/database";

export const metadata: Metadata = {
    title: "Tickets — Admin",
};

// Default view: everything still needing attention (all statuses except closed).
const DEFAULT_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_client"];
const SORT_VALUES: TicketSort[] = ["recent", "updated", "waiting_longest"];

interface AdminTicketsPageProps {
    searchParams: Promise<{
        page?: string;
        status?: string;
        priority?: string;
        sort?: string;
        search?: string;
        client?: string;
        assignee?: string;
    }>;
}

export default async function AdminTicketsPage({ searchParams }: AdminTicketsPageProps) {
    // Reachable only in agency mode (guarded by the /admin layout). Cross-client support inbox.
    const params = await searchParams;
    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const statuses = params.status
        ? (params.status.split(",").filter(Boolean) as TicketStatus[])
        : DEFAULT_STATUSES;
    const priorityFilter = params.priority as
        | "low"
        | "medium"
        | "high"
        | "urgent"
        | "all"
        | undefined;
    const sort: TicketSort = SORT_VALUES.includes(params.sort as TicketSort)
        ? (params.sort as TicketSort)
        : "recent";
    const search = params.search?.trim() || undefined;
    const clientId = params.client && params.client !== "all" ? params.client : undefined;
    const assignee = params.assignee && params.assignee !== "all" ? params.assignee : undefined;
    const mainFilters = {
        status: statuses,
        priority: priorityFilter || "all",
        sort,
        search,
        clientId,
        assignee,
    };

    const [firstPage, allOpen, allInProgress, allClosed, clients, adminUsers] = await Promise.all([
        getTicketsPaginated(mainFilters, page),
        getTicketsPaginated({ status: "open", priority: "all" }, 1),
        getTicketsPaginated({ status: "in_progress", priority: "all" }, 1),
        getTicketsPaginated({ status: "closed", priority: "all" }, 1),
        getClientsForTickets(),
        getAdminUsers(),
    ]);

    // Clamp an out-of-range page (e.g. a stale URL after narrowing filters).
    const paginated =
        firstPage.total > 0 && page > firstPage.totalPages
            ? await getTicketsPaginated(mainFilters, firstPage.totalPages)
            : firstPage;

    return (
        <PageContainer>
            <div className="flex flex-col gap-8">
                <div className="flex items-start justify-between px-4">
                    <div className="flex flex-col gap-4">
                        <PageTitle>{t(lang, "tickets.title")}</PageTitle>
                        <PageSubtitle>{t(lang, "tickets.subtitle")}</PageSubtitle>
                    </div>
                    <Link
                        href="/admin/tickets/new"
                        className="flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 text-[12px] font-bold uppercase leading-[1.5] tracking-[0.48px] text-white transition-colors hover:bg-orange-dark">
                        <PlusCircle className="size-3.5" />
                        {t(lang, "tickets.new_request")}
                    </Link>
                </div>

                <div className="flex flex-col gap-4 md:flex-row">
                    <StatCard
                        value={allOpen.total}
                        label={t(lang, "tickets.stats.submitted")}
                        description={t(lang, "tickets.stats.submitted_desc")}
                        icon={<Inbox className="size-6 text-brand" />}
                    />
                    <StatCard
                        value={allInProgress.total}
                        label={t(lang, "tickets.stats.in_progress")}
                        description={t(lang, "tickets.stats.in_progress_desc")}
                        icon={<Clock className="size-6 text-brand" />}
                    />
                    <StatCard
                        value={allClosed.total}
                        label={t(lang, "tickets.stats.completed")}
                        description={t(lang, "tickets.stats.completed_desc")}
                        icon={<CheckCircle2 className="size-6 text-brand" />}
                    />
                </div>

                <TicketsList
                    tickets={paginated.tickets}
                    isAdmin
                    advanced
                    basePath="/admin/tickets"
                    clients={clients}
                    assignableUsers={adminUsers}
                    pagination={{
                        page: paginated.page,
                        perPage: paginated.perPage,
                        total: paginated.total,
                        totalPages: paginated.totalPages,
                    }}
                />
            </div>
        </PageContainer>
    );
}

function StatCard({
    value,
    label,
    description,
    icon,
}: {
    value: number;
    label: string;
    description: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-brand-soft">
                {icon}
            </div>
            <p
                className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                {value}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-ink">{label}</p>
            <p className="text-[16px] leading-[1.5] text-ink-muted">{description}</p>
        </div>
    );
}
