"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TicketWithDetails, TicketStatus } from "@/types/database";

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

const STATUS_OPTIONS: { value: TicketStatus | "all"; labelKey: string; color: string; activeColor: string }[] = [
  { value: "all", labelKey: "tickets.all", color: "", activeColor: "" },
  { value: "open", labelKey: "tickets.open", color: "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950", activeColor: "bg-red-500 text-white border-red-500" },
  { value: "in_progress", labelKey: "tickets.in_progress", color: "border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950", activeColor: "bg-blue-500 text-white border-blue-500" },
  { value: "waiting_on_client", labelKey: "tickets.waiting_on_client", color: "border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950", activeColor: "bg-yellow-500 text-white border-yellow-500" },
  { value: "closed", labelKey: "tickets.closed", color: "border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950", activeColor: "bg-green-500 text-white border-green-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature_request: "Feature Request",
  support: "Support",
  billing: "Billing",
};

export function TicketsList({ tickets, isAdmin, pagination }: TicketsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const { t } = useLanguage();

  const currentStatus = searchParams.get("status") || "all";
  const currentPage = pagination?.page ?? 1;

  const filteredTickets = search
    ? tickets.filter((ticket) => {
        const searchLower = search.toLowerCase();
        return (
          ticket.subject.toLowerCase().includes(searchLower) ||
          ticket.description.toLowerCase().includes(searchLower) ||
          ticket.client_name.toLowerCase().includes(searchLower)
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

  function handleStatusFilter(status: string) {
    navigateTo({ status, page: undefined });
  }

  function handlePageChange(page: number) {
    navigateTo({ page: String(page) });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("tickets.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {pagination
              ? `${pagination.total} ${t("tickets.ticket")}${pagination.total !== 1 ? "s" : ""}`
              : `${filteredTickets.length} ${t("tickets.ticket")}${filteredTickets.length !== 1 ? "s" : ""}`}
          </span>
          <Link href="/tickets/new">
            <Button size="sm">{t("tickets.new_ticket")}</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder={t("tickets.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("tickets.search_placeholder")}
          className="w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusFilter(status.value)}
              aria-pressed={currentStatus === status.value}
              className={`inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                currentStatus === status.value
                  ? status.value === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : status.activeColor
                  : status.value === "all"
                    ? "border-border text-foreground hover:bg-muted bg-background"
                    : status.color + " bg-background"
              }`}
            >
              {t(status.labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets */}
      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {tickets.length === 0
                ? t("tickets.no_tickets")
                : t("tickets.no_matching")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-lg font-bold hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                        {ticket.priority}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {ticket.description}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{timeAgo(ticket.created_at)}</span>
                      <span>•</span>
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      {isAdmin && (
                        <>
                          <span>•</span>
                          <span>{ticket.client_name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{t("tickets.by")} {ticket.created_by_name}</span>
                      {ticket.assigned_to_name && (
                        <>
                          <span>•</span>
                          <span>{t("tickets.assigned_to")}: {ticket.assigned_to_name}</span>
                        </>
                      )}
                      {ticket.reply_count > 0 && (
                        <>
                          <span>•</span>
                          <span>{ticket.reply_count} {ticket.reply_count === 1 ? t("tickets.reply") : t("tickets.replies")}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      ticket.status === "open"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : ticket.status === "in_progress"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : ticket.status === "waiting_on_client"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    }`}>
                      {ticket.status === "open" && t("tickets.open")}
                      {ticket.status === "in_progress" && t("tickets.in_progress")}
                      {ticket.status === "waiting_on_client" && t("tickets.waiting_on_client")}
                      {ticket.status === "closed" && t("tickets.closed")}
                    </span>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted sm:h-9 sm:px-3"
                    >
                      {t("tickets.view")}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("leads.showing")} {(currentPage - 1) * pagination.perPage + 1}–
            {Math.min(currentPage * pagination.perPage, pagination.total)} {t("leads.of")}{" "}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              {t("leads.previous")}
            </Button>
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
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="min-w-[36px]"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              {t("leads.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
