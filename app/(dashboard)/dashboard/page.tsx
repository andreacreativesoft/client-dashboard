import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeads } from "@/lib/actions/leads";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { t } from "@/lib/i18n/translations";
import type { AppLanguage } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

function MonitorIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A5959">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  );
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
      <div className="flex size-[48px] items-center justify-center rounded-full bg-[#DDE9E5]">
        {icon}
      </div>
      <div className="flex flex-col items-center text-center">
        <p
          className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#F2612E]"
          style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
        >
          {value}
        </p>
        <p className="text-[16px] font-bold leading-[1.5] text-[#2E2E2E]">
          {label}
        </p>
      </div>
      <p className="text-[16px] leading-[1.5] text-[#6D6A65]">
        {description}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const profile = await getProfile();
  const leads = await getLeads();

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

  const lang = profile?.language || "en";

  // Calculate stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newLeads = leads.filter((l) => l.created_at >= thirtyDaysAgo);

  return (
    <div className="px-8 py-12 font-[Helvetica,Arial,sans-serif]">
      <div className="flex flex-col gap-16">
        {/* Section: Heading + Cards */}
        <div className="flex flex-col gap-8">
          {/* Heading */}
          <div className="flex flex-col gap-4 px-4">
            <h1
              className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]"
              style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
            >
              {t(lang, "dashboard.hello")} {firstName} !
            </h1>
            <p className="text-[18px] leading-[1.5] text-[#6D6A65]">
              {t(lang, "dashboard.overview_subtitle")}
            </p>
          </div>

          {/* Stat cards */}
          <div className="flex flex-col gap-4 md:flex-row">
            <StatCard
              icon={<MonitorIcon />}
              value="Live"
              label={t(lang, "dashboard.site_status")}
              description={t(lang, "dashboard.site_ok")}
            />
            <StatCard
              icon={<UsersIcon />}
              value={newLeads.length.toLocaleString()}
              label={t(lang, "dashboard.leads_this_month")}
              description={`${leads.length} ${t(lang, "dashboard.leads_total_desc")}`}
            />
            <StatCard
              icon={<StarIcon />}
              value={String(newLeads.filter((l) => l.status === "new").length)}
              label={t(lang, "dashboard.new_leads")}
              description={t(lang, "dashboard.awaiting_contact_desc")}
            />
          </div>
        </div>

        {/* CTA Banner */}
        <div className="flex flex-col items-start gap-3 rounded-[24px] bg-[#DDE9E5] p-8 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] md:flex-row md:items-center">
          <div className="flex flex-1 flex-col gap-3">
            <h2
              className="text-[26px] font-extrabold uppercase leading-[1.3] text-[#2E2E2E]"
              style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
            >
              {t(lang, "dashboard.need_help")}
            </h2>
            <p className="text-[14px] leading-[1.5] text-[#6D6A65]">
              {t(lang, "dashboard.need_help_desc")}
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="flex items-center gap-2 rounded-full bg-[#F2612E] px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-[#E0551F]"
          >
            <ChatIcon />
            {t(lang, "dashboard.request_changes")}
          </Link>
        </div>
      </div>
    </div>
  );
}
