import { CheckCircle2, Clock, Inbox, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TicketsList } from "@/components/tickets/tickets-list";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getTicketsPaginated } from "@/lib/actions/tickets";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Demandes",
};

interface TicketsPageProps {
    searchParams: Promise<{
        page?: string;
        status?: string;
        priority?: string;
        search?: string;
    }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
    const params = await searchParams;
    // Client-facing list only — the agency support inbox lives at /admin/tickets.
    const { profile } = await requireClientView();
    const lang = profile.language || "fr-BE";

    const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const statusFilter = params.status as
        | "open"
        | "in_progress"
        | "waiting_on_client"
        | "closed"
        | "all"
        | undefined;
    const priorityFilter = params.priority as
        | "low"
        | "medium"
        | "high"
        | "urgent"
        | "all"
        | undefined;
    const search = params.search?.trim() || undefined;
    const mainFilters = {
        status: statusFilter || ("all" as const),
        priority: priorityFilter || ("all" as const),
        search,
    };

    const [firstPage, allOpen, allInProgress, allClosed] = await Promise.all([
        getTicketsPaginated(mainFilters, page),
        getTicketsPaginated({ status: "open", priority: "all" }, 1),
        getTicketsPaginated({ status: "in_progress", priority: "all" }, 1),
        getTicketsPaginated({ status: "closed", priority: "all" }, 1),
    ]);

    // Clamp an out-of-range page (e.g. a stale URL after narrowing filters).
    const paginated =
        firstPage.total > 0 && page > firstPage.totalPages
            ? await getTicketsPaginated(mainFilters, firstPage.totalPages)
            : firstPage;

    const submittedCount = allOpen.total;
    const inProgressCount = allInProgress.total;
    const completedCount = allClosed.total;

    return (
        <PageContainer>
            <div className="flex flex-col gap-8">
                {/* Header row */}
                <div className="flex items-start justify-between px-4">
                    <div className="flex flex-col gap-4">
                        <PageTitle>{t(lang, "tickets.title")}</PageTitle>
                        <PageSubtitle>{t(lang, "tickets.subtitle")}</PageSubtitle>
                    </div>
                    <Link
                        href="/tickets/new"
                        className="flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 text-[12px] font-bold uppercase leading-[1.5] tracking-[0.48px] text-white transition-colors hover:bg-orange-dark">
                        <PlusCircle className="size-3.5" />
                        {t(lang, "tickets.new_request")}
                    </Link>
                </div>

                {/* Stat cards — tickets data this time, not leads */}
                <div className="flex flex-col gap-4 md:flex-row">
                    <StatCard
                        value={submittedCount}
                        label={t(lang, "tickets.stats.submitted")}
                        description={t(lang, "tickets.stats.submitted_desc")}
                        icon={<Inbox className="size-6 text-brand" />}
                    />
                    <StatCard
                        value={inProgressCount}
                        label={t(lang, "tickets.stats.in_progress")}
                        description={t(lang, "tickets.stats.in_progress_desc")}
                        icon={<Clock className="size-6 text-brand" />}
                    />
                    <StatCard
                        value={completedCount}
                        label={t(lang, "tickets.stats.completed")}
                        description={t(lang, "tickets.stats.completed_desc")}
                        icon={<CheckCircle2 className="size-6 text-brand" />}
                    />
                </div>

                {/* Tickets table */}
                <TicketsList
                    tickets={paginated.tickets}
                    isAdmin={false}
                    basePath="/tickets"
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
