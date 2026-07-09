import { CheckCircle2, Inbox, Loader } from "lucide-react";
import type { Metadata } from "next";

import { LeadInsights } from "@/components/analytics/lead-insights";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import {
    getSubmissionsPaginated,
    getSubmissionStats,
    getSubmissionDailyCounts,
    getSubmissionTopSources,
} from "@/lib/actions/submissions";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

import { SubmissionsList } from "./submissions-list";

export const metadata: Metadata = {
    title: "Contacts",
};

interface SubmissionsPageProps {
    searchParams: Promise<{
        page?: string;
        status?: string;
        search?: string;
    }>;
}

export default async function SubmissionsPage({ searchParams }: SubmissionsPageProps) {
    await requireClientView();

    const params = await searchParams;
    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    const requestedPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const statusFilter = params.status as "new" | "contacted" | "done" | "all" | undefined;
    const search = params.search?.trim() || undefined;
    const filters = { status: statusFilter || ("all" as const), search };

    const [firstResult, stats, dailyCounts, topSources] = await Promise.all([
        getSubmissionsPaginated(filters, requestedPage),
        getSubmissionStats(),
        getSubmissionDailyCounts(30),
        getSubmissionTopSources(30, 5),
    ]);

    // Clamp an out-of-range page (e.g. a stale URL after narrowing filters).
    const result =
        firstResult.total > 0 && requestedPage > firstResult.totalPages
            ? await getSubmissionsPaginated(filters, firstResult.totalPages)
            : firstResult;

    return (
        <PageContainer>
            <div className="flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col gap-4 px-4">
                    <PageTitle>{t(lang, "leads.title")}</PageTitle>
                    <PageSubtitle>{t(lang, "submissions.subtitle")}</PageSubtitle>
                </div>

                {/* Stat cards */}
                <div className="flex flex-col gap-4 md:flex-row">
                    <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex size-[48px] items-center justify-center rounded-full bg-brand-soft">
                            <Inbox className="size-6 text-brand" />
                        </div>
                        <p
                            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                            {stats.last30}
                        </p>
                        <p className="text-[16px] font-bold leading-[1.5] text-ink">
                            {t(lang, "submissions.stat_received")}
                        </p>
                        <p className="text-[16px] leading-[1.5] text-ink-muted">
                            {t(lang, "submissions.stat_received_sub")}
                        </p>
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex size-[48px] items-center justify-center rounded-full bg-brand-soft">
                            <Loader className="size-6 text-brand" />
                        </div>
                        <p
                            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                            {stats.contacted30}
                        </p>
                        <p className="text-[16px] font-bold leading-[1.5] text-ink">
                            {t(lang, "submissions.stat_in_progress")}
                        </p>
                        <p className="text-[16px] leading-[1.5] text-ink-muted">
                            {t(lang, "submissions.stat_in_progress_sub")}
                        </p>
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex size-[48px] items-center justify-center rounded-full bg-brand-soft">
                            <CheckCircle2 className="size-6 text-brand" />
                        </div>
                        <p
                            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                            {stats.done30}
                        </p>
                        <p className="text-[16px] font-bold leading-[1.5] text-ink">
                            {t(lang, "submissions.stat_handled")}
                        </p>
                        <p className="text-[16px] leading-[1.5] text-ink-muted">
                            {t(lang, "submissions.stat_handled_sub")}
                        </p>
                    </div>
                </div>

                {/* Détails repliables : tendance des prospects + sources d'origine */}
                <Accordion
                    type="single"
                    collapsible
                    className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                    <AccordionItem value="insights">
                        <AccordionTrigger className="text-[16px]">
                            {t(lang, "submissions.insights_title")}
                        </AccordionTrigger>
                        <AccordionContent>
                            <LeadInsights
                                dailyCounts={dailyCounts}
                                topSources={topSources}
                                lang={lang}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {/* Table */}
                <SubmissionsList
                    submissions={result.submissions}
                    pagination={{
                        page: result.page,
                        perPage: result.perPage,
                        total: result.total,
                        totalPages: result.totalPages,
                    }}
                />
            </div>
        </PageContainer>
    );
}
