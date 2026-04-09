"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { TicketWithDetails } from "@/types/database";

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
}

export function TicketsList({ tickets, isAdmin, pagination }: TicketsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const currentPage = pagination?.page ?? 1;

  const filteredTickets = search
    ? tickets.filter((ticket) => {
        const s = search.toLowerCase();
        return (
          ticket.subject.toLowerCase().includes(s) ||
          ticket.description.toLowerCase().includes(s) ||
          ticket.client_name.toLowerCase().includes(s)
        );
      })
    : tickets;

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

  function handlePageChange(page: number) {
    navigateTo({ page: String(page) });
  }

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      {/* Header: search + filter */}
      <div className="flex items-center justify-between p-4">
        <div className="w-[384px]">
          <div className="flex items-center gap-2 rounded-lg border border-[#B5C3BE] bg-[#F9FAFB] px-4 py-3">
            <svg className="size-4 text-[#6D6A65]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher des prospects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none"
            />
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#2E2E2E] transition-colors hover:bg-[#F9FAFB]">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
          Filtrer
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F1F1F1]">
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Name</th>
              {isAdmin && <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Client</th>}
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Statut</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Priorité</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Date</th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-[#6D6A65]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center text-[14px] text-[#6D6A65]">
                  {tickets.length === 0 ? "Aucun ticket pour le moment." : "Aucun résultat trouvé."}
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-[#F1F1F1]">
                  <td className="px-4 py-4 text-center">
                    <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                      <span className="block text-[14px] leading-[1.5] text-[#2E2E2E]">{ticket.subject}</span>
                      <span className="block text-[14px] leading-[1.5] text-[#6D6A65]">{ticket.created_by_name}</span>
                    </Link>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                      {ticket.client_name}
                    </td>
                  )}
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] ${
                      ticket.status === "open"
                        ? "bg-[#FEEFEA] text-[#F2612E]"
                        : ticket.status === "closed"
                          ? "bg-[#DEF7EC] text-[#03543F]"
                          : "bg-[#DEF7EC] text-[#03543F]"
                    }`}>
                      {ticket.status === "open" && "Contacter"}
                      {ticket.status === "in_progress" && "En cours"}
                      {ticket.status === "waiting_on_client" && "En attente"}
                      {ticket.status === "closed" && "Contacté"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                    {ticket.priority}
                  </td>
                  <td className="px-4 py-4 text-center text-[14px] text-[#6D6A65]">
                    {formatDate(ticket.created_at)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-4">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-[#6D6A65] transition-colors hover:text-[#2A5959]"
                        title="Voir le ticket"
                      >
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

      {/* Footer: pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between p-4">
          <p className="text-[14px] text-[#6D6A65]">
            Showing <span className="font-bold text-[#2E2E2E]">{(currentPage - 1) * pagination.perPage + 1}-{Math.min(currentPage * pagination.perPage, pagination.total)}</span> of <span className="font-bold text-[#2E2E2E]">{pagination.total}</span>
          </p>
          <div className="flex overflow-hidden rounded border border-[#F1F1F1]">
            <button
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(1)}
              className="flex h-8 items-center justify-center bg-white px-3 text-[#6D6A65] transition-colors hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              &laquo;
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] transition-colors hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              &lsaquo;
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`flex h-8 items-center justify-center border-l border-[#F1F1F1] px-3 text-[14px] transition-colors ${
                    pageNum === currentPage
                      ? "bg-[#F2612E] text-white"
                      : "bg-white text-[#6D6A65] hover:bg-[#F9FAFB]"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={currentPage >= pagination.totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] transition-colors hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              &rsaquo;
            </button>
            <button
              disabled={currentPage >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.totalPages)}
              className="flex h-8 items-center justify-center border-l border-[#F1F1F1] bg-white px-3 text-[#6D6A65] transition-colors hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
