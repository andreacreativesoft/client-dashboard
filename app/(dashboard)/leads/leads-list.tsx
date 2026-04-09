"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { updateLeadStatusAction, type LeadWithDetails } from "@/lib/actions/leads";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import type { LeadStatus } from "@/types/database";

interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface LeadsListProps {
  leads: LeadWithDetails[];
  isAdmin: boolean;
  pagination?: PaginationInfo;
}

export function LeadsList({ leads, isAdmin, pagination }: LeadsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const { t } = useLanguage();

  const currentStatus = searchParams.get("status") || "all";
  const currentPage = pagination?.page ?? 1;

  const filteredLeads = search
    ? leads.filter((lead) => {
        const s = search.toLowerCase();
        return (
          lead.name?.toLowerCase().includes(s) ||
          lead.email?.toLowerCase().includes(s) ||
          lead.phone?.toLowerCase().includes(s) ||
          lead.client_name.toLowerCase().includes(s)
        );
      })
    : leads;

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

  function handleStatusFilter(status: string) {
    navigateTo({ status, page: undefined });
  }

  function handlePageChange(page: number) {
    navigateTo({ page: String(page) });
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    setUpdating(leadId);
    await updateLeadStatusAction(leadId, newStatus);
    setUpdating(null);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      {/* Header: search + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="w-full sm:w-[384px]">
          <div className="flex items-center gap-2 rounded-lg border border-[#B5C3BE] bg-[#F9FAFB] px-4 py-3">
            <svg className="size-4 text-[#6D6A65]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder={t("leads.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {["all", "new", "contacted", "done"].map((status) => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[14px] transition-colors ${
                currentStatus === status
                  ? "border-[#F2612E] bg-[#F2612E] text-white"
                  : "border-[#E5E7EB] bg-white text-[#2E2E2E] hover:bg-[#F9FAFB]"
              }`}
            >
              {status === "all" ? t("leads.all") : t(`leads.${status}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F1F1F1]">
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Name</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Phone</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Source</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Status</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Date</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-[#6D6A65]">
                  {leads.length === 0 ? t("leads.no_leads_empty") : t("leads.no_match")}
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-[#F1F1F1]">
                  <td className="px-4 py-4 text-center">
                    <Link href={`/leads/${lead.id}`} className="hover:underline">
                      <span className="block text-[14px] leading-[1.5] text-[#2E2E2E]">
                        {lead.name || t("leads.unknown")}
                      </span>
                      <span className="block text-[14px] leading-[1.5] text-[#6D6A65]">
                        {lead.email || ""}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                    {lead.phone || "—"}
                  </td>
                  <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                    {lead.website_name}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => {
                        const next: LeadStatus = lead.status === "new" ? "contacted" : lead.status === "contacted" ? "done" : "new";
                        handleStatusChange(lead.id, next);
                      }}
                      disabled={updating === lead.id}
                      className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] transition-opacity disabled:opacity-50 ${
                        lead.status === "new"
                          ? "bg-[#FEEFEA] text-[#F2612E]"
                          : lead.status === "contacted"
                            ? "bg-[#DEF7EC] text-[#03543F]"
                            : "bg-[#DDE9E5] text-[#2A5959]"
                      }`}
                    >
                      {lead.status === "new" ? t("leads.new") : lead.status === "contacted" ? t("leads.contacted") : t("leads.done")}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-4">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="text-[#6D6A65] hover:text-[#2A5959]" title="Call">
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                          </svg>
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="text-[#6D6A65] hover:text-[#2A5959]" title="Email">
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                          </svg>
                        </a>
                      )}
                      <Link href={`/leads/${lead.id}`} className="text-[#6D6A65] hover:text-[#2A5959]" title="View">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      </Link>
                    </div>
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
          <p className="text-[14px] text-[#6D6A65]">
            {t("leads.showing")} <span className="font-bold text-[#2E2E2E]">{(currentPage - 1) * pagination.perPage + 1}-{Math.min(currentPage * pagination.perPage, pagination.total)}</span> {t("leads.of")} <span className="font-bold text-[#2E2E2E]">{pagination.total}</span>
          </p>
          <div className="flex overflow-hidden rounded border border-[#F1F1F1]">
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(1)} className="flex h-8 items-center justify-center bg-white px-3 text-[#6D6A65] hover:bg-[#F9FAFB] disabled:opacity-30">&laquo;</button>
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)} className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] hover:bg-[#F9FAFB] disabled:opacity-30">&lsaquo;</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`flex h-8 items-center justify-center border-l border-[#F1F1F1] px-3 text-[14px] ${pageNum === currentPage ? "bg-[#F2612E] text-white" : "bg-white text-[#6D6A65] hover:bg-[#F9FAFB]"}`}>{pageNum}</button>
              );
            })}
            <button disabled={currentPage >= pagination.totalPages} onClick={() => handlePageChange(currentPage + 1)} className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] hover:bg-[#F9FAFB] disabled:opacity-30">&rsaquo;</button>
            <button disabled={currentPage >= pagination.totalPages} onClick={() => handlePageChange(pagination.totalPages)} className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] hover:bg-[#F9FAFB] disabled:opacity-30">&raquo;</button>
          </div>
        </div>
      )}
    </div>
  );
}
