"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  updateLeadStatusAction,
  type LeadWithDetails,
} from "@/lib/actions/leads";
import { timeAgo } from "@/lib/utils";
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

const STATUS_OPTIONS: { value: LeadStatus; labelKey: "leads.new" | "leads.contacted" | "leads.done"; color: string; activeColor: string }[] = [
  { value: "new", labelKey: "leads.new", color: "border-red-300 text-red-600 hover:bg-red-50", activeColor: "bg-red-500 text-white border-red-500" },
  { value: "contacted", labelKey: "leads.contacted", color: "border-blue-300 text-blue-600 hover:bg-blue-50", activeColor: "bg-blue-500 text-white border-blue-500" },
  { value: "done", labelKey: "leads.done", color: "border-green-300 text-green-600 hover:bg-green-50", activeColor: "bg-green-500 text-white border-green-500" },
];

export function LeadsList({ leads, isAdmin, pagination }: LeadsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const { t } = useLanguage();

  const currentStatus = searchParams.get("status") || "all";
  const currentPage = pagination?.page ?? 1;

  // Client-side search filter (filters within the current page)
  const filteredLeads = search
    ? leads.filter((lead) => {
        const searchLower = search.toLowerCase();
        return (
          lead.name?.toLowerCase().includes(searchLower) ||
          lead.email?.toLowerCase().includes(searchLower) ||
          lead.phone?.toLowerCase().includes(searchLower) ||
          lead.client_name.toLowerCase().includes(searchLower)
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
  }

  const count = pagination ? pagination.total : filteredLeads.length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("leads.title")}</h1>
        <span className="text-sm text-muted-foreground">
          {count} {count !== 1 ? t("leads.leads") : t("leads.lead")}
        </span>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder={t("leads.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("leads.search_placeholder")}
          className="w-full sm:w-64"
        />
        <div className="flex gap-2">
          <Button
            variant={currentStatus === "all" ? "default" : "outline"}
            size="sm"
            aria-pressed={currentStatus === "all"}
            onClick={() => handleStatusFilter("all")}
          >
            {t("leads.all")}
          </Button>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusFilter(status.value)}
              aria-pressed={currentStatus === status.value}
              className={`inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                currentStatus === status.value
                  ? status.activeColor
                  : status.color + " bg-background"
              }`}
            >
              {t(status.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Leads */}
      {filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {leads.length === 0
                ? t("leads.no_leads_empty")
                : t("leads.no_match")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-lg font-bold hover:underline"
                      >
                        {lead.name || lead.email || lead.phone || t("leads.unknown")}
                      </Link>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {lead.email && <span>{lead.email}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>

                    {lead.message && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {lead.message}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{timeAgo(lead.created_at)}</span>
                      <span>&bull;</span>
                      <span>{lead.website_name}</span>
                      {isAdmin && (
                        <>
                          <span>&bull;</span>
                          <span>{lead.client_name}</span>
                        </>
                      )}
                      {lead.form_name && (
                        <>
                          <span>&bull;</span>
                          <span>{t("leads.form")}: {lead.form_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <div className="flex flex-1 rounded-lg border border-border overflow-hidden">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status.value}
                          onClick={(e) => {
                            e.preventDefault();
                            handleStatusChange(lead.id, status.value);
                          }}
                          disabled={updating === lead.id}
                          aria-pressed={lead.status === status.value}
                          aria-label={t(status.labelKey)}
                          className={`flex-1 cursor-pointer px-4 py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:py-1.5 sm:text-xs ${
                            lead.status === status.value
                              ? status.activeColor
                              : status.color + " bg-background"
                          }`}
                        >
                          {t(status.labelKey)}
                        </button>
                      ))}
                    </div>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted sm:h-9 sm:px-3"
                    >
                      {t("leads.view")}
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
            {/* Page numbers */}
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
