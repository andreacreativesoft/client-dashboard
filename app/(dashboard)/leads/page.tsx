import type { Metadata } from "next";
import { getLeadsPaginated, getLeads } from "@/lib/actions/leads";
import { getProfile } from "@/lib/actions/profile";
import { LeadsList } from "./leads-list";

export const metadata: Metadata = {
  title: "Leads",
};

interface LeadsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const lang = profile?.language || "en";

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const statusFilter = params.status as "new" | "contacted" | "done" | "all" | undefined;

  const [result, allLeads] = await Promise.all([
    getLeadsPaginated({ status: statusFilter || "all" }, page),
    getLeads(),
  ]);

  // Stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentLeads = allLeads.filter((l) => l.created_at >= thirtyDaysAgo);
  const newCount = recentLeads.filter((l) => l.status === "new").length;
  const contactedCount = recentLeads.filter((l) => l.status === "contacted").length;
  const doneCount = recentLeads.filter((l) => l.status === "done").length;

  return (
    <div className="px-8 py-12 font-[Helvetica,Arial,sans-serif]">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4 px-4">
          <h1
            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]"
            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
          >
            {lang === "fr-BE" ? "Contacter les prospects" : lang === "ro" ? "Contactați prospecții" : "Contact Prospects"}
          </h1>
          <p className="text-[18px] leading-[1.5] text-[#6D6A65]">
            {lang === "fr-BE" ? "Gérez et suivez tous les prospects de votre site web" : lang === "ro" ? "Gestionați și urmăriți toți prospecții site-ului dvs." : "Manage and track all your website prospects"}
          </p>
        </div>

        {/* Stat cards */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{recentLeads.length}</p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{lang === "fr-BE" ? "Leads totaux" : "Total Leads"}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{lang === "fr-BE" ? "Ce mois-ci" : "This month"}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{contactedCount}</p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{lang === "fr-BE" ? "Contacté" : "Contacted"}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{lang === "fr-BE" ? "En cours de suivi" : "In progress"}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 rounded-[24px] bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
            <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
              </svg>
            </div>
            <p className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{doneCount}</p>
            <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">{lang === "fr-BE" ? "Devenus clients" : "Converted"}</p>
            <p className="text-[16px] leading-[1.5] text-[#6D6A65]">{lang === "fr-BE" ? "Convertis" : "Completed"}</p>
          </div>
        </div>

        {/* Table */}
        <LeadsList
          leads={result.leads}
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
