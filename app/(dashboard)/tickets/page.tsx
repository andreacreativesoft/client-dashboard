import type { Metadata } from "next";
import Link from "next/link";
import { getTicketsPaginated } from "@/lib/actions/tickets";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { t } from "@/lib/i18n/translations";
import { getLeads } from "@/lib/actions/leads";
import { TicketsList } from "./tickets-list";

export const metadata: Metadata = {
  title: "Tickets",
};

interface TicketsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    priority?: string;
  }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const impersonatedClientId = profile?.role === "admin" ? await getImpersonatedClientId() : null;
  const isAdmin = profile?.role === "admin" && !impersonatedClientId;
  const lang = profile?.language || "en";

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const statusFilter = params.status as "open" | "in_progress" | "waiting_on_client" | "closed" | "all" | undefined;
  const priorityFilter = params.priority as "low" | "medium" | "high" | "urgent" | "all" | undefined;

  const [result, leads] = await Promise.all([
    getTicketsPaginated(
      {
        status: statusFilter || "all",
        priority: priorityFilter || "all",
      },
      page
    ),
    getLeads(),
  ]);

  // Calculate lead stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentLeads = leads.filter((l) => l.created_at >= thirtyDaysAgo);
  const contactedCount = recentLeads.filter((l) => l.status === "contacted").length;
  const doneCount = recentLeads.filter((l) => l.status === "done").length;

  return (
    <div className="px-8 py-12 font-[Helvetica,Arial,sans-serif]">
      <div className="flex flex-col gap-8">
        {/* Header row */}
        <div className="flex items-start justify-between px-4">
          <div className="flex flex-col gap-4">
            <h1
              className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]"
              style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
            >
              {t(lang, "crm.title")}
            </h1>
            <p className="text-[18px] leading-[1.5] text-[#6D6A65]">
              {t(lang, "crm.subtitle")}
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="flex items-center gap-2 rounded-full bg-[#F2612E] px-5 py-2.5 text-[12px] font-bold uppercase leading-[1.5] tracking-[0.48px] text-white transition-colors hover:bg-[#E0551F]"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {t(lang, "crm.add_prospect")}
          </Link>
        </div>

        {/* Stat cards */}
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {recentLeads.length}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "crm.total_leads")}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{t(lang, "crm.this_month")}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {contactedCount}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "crm.contacted")}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{t(lang, "crm.in_progress")}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
              {doneCount}
            </p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{t(lang, "crm.converted")}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{t(lang, "crm.completed")}</p>
          </div>
        </div>

        {/* Tickets table */}
        <TicketsList
          tickets={result.tickets}
          isAdmin={isAdmin}
          pagination={{
            page: result.page,
            perPage: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
          }}
        />
      </div>
    </div>
  );
}
