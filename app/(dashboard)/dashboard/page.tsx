import { CalendarDays, MessageSquare, Sparkles, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageTitle, PageSubtitle, SectionTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { getSubmissionStats } from "@/lib/actions/submissions";
import { t } from "@/lib/i18n/translations";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { createClient } from "@/lib/supabase/server";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Dashboard",
};

function WeekIcon() {
    return <CalendarDays className="size-6 text-brand" />;
}

function UsersIcon() {
    return <Users className="size-6 text-brand" />;
}

function StarIcon() {
    return <Star className="size-6 text-brand" />;
}

function ChatIcon() {
    return <MessageSquare className="size-4 text-white" />;
}

function SparkIcon() {
    return <Sparkles className="size-6 text-orange" />;
}

function StatCard({
    icon,
    value,
    label,
    description,
}: {
    icon: React.ReactNode;
    value: string;
    label: string;
    description: string;
}) {
    return (
        <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-brand-soft">
                {icon}
            </div>
            <div className="flex flex-col items-center text-center">
                <p
                    className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-orange"
                    style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                    {value}
                </p>
                <p className="text-[16px] font-bold leading-[1.5] text-ink">{label}</p>
            </div>
            <p className="text-[16px] leading-[1.5] text-ink-muted">{description}</p>
        </div>
    );
}

export default async function DashboardPage() {
    await requireClientView();

    const profile = await getProfile();
    const stats = await getSubmissionStats();

    let firstName = profile?.full_name?.split(" ")[0] || "there";
    const isAdmin = profile?.role === "admin";

    // Get websites for this user (or impersonated client)
    const supabase = await createClient();

    if (isAdmin) {
        const impersonatedClientId = await getImpersonatedClientId();
        if (impersonatedClientId) {
            const { data: client } = await supabase
                .from("clients")
                .select("business_name")
                .eq("id", impersonatedClientId)
                .single();
            if (client) {
                firstName = client.business_name;
            }
        }
    }

    const lang = profile?.language || "fr-BE";

    const uncontactedThisWeek = stats.new7;
    const weeklyCount = stats.last7;

    return (
        <PageContainer>
            <div className="flex flex-col gap-16">
                {/* Section: Heading + Cards */}
                <div className="flex flex-col gap-8">
                    {/* Heading */}
                    <div className="flex flex-col gap-4 px-4">
                        <PageTitle>
                            {t(lang, "dashboard.hello")} {firstName} !
                        </PageTitle>
                        <PageSubtitle>{t(lang, "dashboard.overview_subtitle")}</PageSubtitle>
                    </div>

                    {/* Stat cards */}
                    <div className="flex flex-col gap-4 md:flex-row">
                        <StatCard
                            icon={<WeekIcon />}
                            value={stats.last7.toLocaleString()}
                            label={t(lang, "dashboard.leads_this_week")}
                            description={t(lang, "dashboard.leads_week_desc")}
                        />
                        <StatCard
                            icon={<UsersIcon />}
                            value={stats.last30.toLocaleString()}
                            label={t(lang, "dashboard.leads_this_month")}
                            description={`${stats.total} ${t(lang, "dashboard.leads_total_desc")}`}
                        />
                        <StatCard
                            icon={<StarIcon />}
                            value={String(stats.new30)}
                            label={t(lang, "dashboard.new_leads")}
                            description={t(lang, "dashboard.awaiting_contact_desc")}
                        />
                    </div>
                </div>

                {/* Insight Message — weekly highlight */}
                <Link
                    href={
                        uncontactedThisWeek > 0
                            ? "/submissions?status=new"
                            : weeklyCount > 0
                              ? "/submissions"
                              : "/submissions"
                    }
                    className="group flex items-start gap-4 rounded-[24px] border border-line-warm bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-[0px_4px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-orange-soft">
                        <SparkIcon />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                        <p className="text-[14px] font-bold uppercase tracking-[0.5px] text-ink-muted">
                            {t(lang, "dashboard.insight_title")}
                        </p>
                        {weeklyCount === 0 ? (
                            <p className="text-[18px] leading-[1.5] text-ink">
                                {t(lang, "dashboard.insight_zero")}
                            </p>
                        ) : (
                            <p className="text-[18px] leading-[1.5] text-ink">
                                {firstName},{" "}
                                <span
                                    className="font-extrabold text-orange"
                                    style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
                                    {weeklyCount}
                                </span>{" "}
                                {weeklyCount === 1
                                    ? t(lang, "dashboard.insight_one_lead")
                                    : t(lang, "dashboard.insight_many_leads")}{" "}
                                {t(lang, "dashboard.insight_this_week")}
                                {uncontactedThisWeek > 0 && (
                                    <>
                                        {" — "}
                                        <span className="font-bold text-brand">
                                            {uncontactedThisWeek}
                                        </span>{" "}
                                        {t(lang, "dashboard.insight_uncontacted")}
                                    </>
                                )}
                                .
                            </p>
                        )}
                    </div>
                    <span className="hidden shrink-0 self-center text-[14px] font-bold uppercase tracking-[0.72px] text-orange group-hover:underline md:inline">
                        {t(lang, "dashboard.insight_cta")} →
                    </span>
                </Link>

                {/* CTA Banner */}
                <div className="flex flex-col items-start gap-3 rounded-[24px] bg-brand-soft p-8 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] md:flex-row md:items-center">
                    <div className="flex flex-1 flex-col gap-3">
                        <SectionTitle>{t(lang, "dashboard.need_help")}</SectionTitle>
                        <p className="text-[14px] leading-[1.5] text-ink-muted">
                            {t(lang, "dashboard.need_help_desc")}
                        </p>
                    </div>
                    <Link
                        href="/tickets/new"
                        className="flex items-center gap-2 rounded-full bg-orange px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-orange-dark">
                        <ChatIcon />
                        {t(lang, "dashboard.request_changes")}
                    </Link>
                </div>
            </div>
        </PageContainer>
    );
}
