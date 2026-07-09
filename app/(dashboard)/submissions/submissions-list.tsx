"use client";

import { Eye, Mail, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
    updateSubmissionStatusAction,
    type SubmissionWithDetails,
} from "@/lib/actions/submissions";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDate } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/database";

interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

interface SubmissionsListProps {
    submissions: SubmissionWithDetails[];
    pagination?: PaginationInfo;
}

export function SubmissionsList({ submissions, pagination }: SubmissionsListProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentStatus = searchParams.get("status") || "all";
    const currentSearch = searchParams.get("search") || "";
    const [search, setSearch] = useState(currentSearch);
    const [updating, setUpdating] = useState<string | null>(null);
    const { t } = useLanguage();

    const currentPage = pagination?.page ?? 1;

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

    // Debounce the search box into the URL so it runs server-side over the whole
    // dataset (and resets to page 1), instead of filtering only the current page.
    useEffect(() => {
        const handle = setTimeout(() => {
            if (search.trim() !== currentSearch) {
                navigateTo({ search: search.trim() || undefined, page: undefined });
            }
        }, 350);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    function handleStatusFilter(status: string) {
        navigateTo({ status, page: undefined });
    }

    function handlePageChange(page: number) {
        navigateTo({ page: String(page) });
    }

    async function handleStatusChange(submissionId: string, newStatus: SubmissionStatus) {
        setUpdating(submissionId);
        await updateSubmissionStatusAction(submissionId, newStatus);
        setUpdating(null);
        router.refresh();
    }

    return (
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
            {/* Header: search + filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="w-full sm:w-[384px]">
                    <div className="flex items-center gap-2 rounded-lg border border-brand-border bg-surface px-4 py-3">
                        <Search className="size-4 text-ink-muted" />
                        <input
                            type="text"
                            placeholder={t("leads.search_placeholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent text-[14px] leading-[1.5] text-ink placeholder-ink-muted outline-none"
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
                                    ? "border-orange bg-orange text-white"
                                    : "border-gray-200 bg-white text-ink hover:bg-surface"
                            }`}>
                            {status === "all"
                                ? t("leads.all")
                                : t(`leads.${status}` as Parameters<typeof t>[0])}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-line">
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_contact")}
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_phone")}
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_source")}
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_status")}
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_date")}
                            </th>
                            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-ink-muted">
                                {t("submissions.col_actions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-12 text-center text-[14px] text-ink-muted">
                                    {currentStatus === "all" && !currentSearch
                                        ? t("leads.no_leads_empty")
                                        : t("leads.no_match")}
                                </td>
                            </tr>
                        ) : (
                            submissions.map((submission) => (
                                <tr key={submission.id} className="border-b border-line">
                                    <td className="px-4 py-4 text-center">
                                        <Link
                                            href={`/submissions/${submission.id}`}
                                            className="hover:underline">
                                            <span className="block text-[14px] leading-[1.5] text-ink">
                                                {submission.name || t("leads.unknown")}
                                            </span>
                                            <span className="block text-[14px] leading-[1.5] text-ink-muted">
                                                {submission.email || ""}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4 text-center text-[14px] text-ink-muted">
                                        {submission.phone || "—"}
                                    </td>
                                    <td className="px-4 py-4 text-center text-[14px] text-ink-muted">
                                        <span className="block text-ink">
                                            {submission.connector_label ?? "—"}
                                        </span>
                                        <span className="block text-[12px] text-ink-muted">
                                            {submission.website_name ?? ""}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                const next: SubmissionStatus =
                                                    submission.status === "new"
                                                        ? "contacted"
                                                        : submission.status === "contacted"
                                                          ? "done"
                                                          : "new";
                                                handleStatusChange(submission.id, next);
                                            }}
                                            disabled={updating === submission.id}
                                            className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-[11px] leading-[1.5] transition-opacity disabled:opacity-50 ${
                                                submission.status === "new"
                                                    ? "bg-orange-soft text-orange"
                                                    : submission.status === "contacted"
                                                      ? "bg-green-soft text-green"
                                                      : "bg-brand-soft text-brand"
                                            }`}>
                                            {submission.status === "new"
                                                ? t("leads.new")
                                                : submission.status === "contacted"
                                                  ? t("leads.contacted")
                                                  : t("leads.done")}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 text-center text-[14px] text-ink-muted">
                                        {formatDate(submission.created_at)}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center gap-4">
                                            {submission.phone && (
                                                <a
                                                    href={`tel:${submission.phone}`}
                                                    className="text-ink-muted hover:text-brand"
                                                    title={t("submissions.action_call")}>
                                                    <Phone className="size-4" />
                                                </a>
                                            )}
                                            {submission.email && (
                                                <a
                                                    href={`mailto:${submission.email}`}
                                                    className="text-ink-muted hover:text-brand"
                                                    title={t("submissions.action_email")}>
                                                    <Mail className="size-4" />
                                                </a>
                                            )}
                                            <Link
                                                href={`/submissions/${submission.id}`}
                                                className="text-ink-muted hover:text-brand"
                                                title={t("submissions.action_view")}>
                                                <Eye className="size-4" />
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
                    <p className="text-[14px] text-ink-muted">
                        {t("leads.showing")}{" "}
                        <span className="font-bold text-ink">
                            {(currentPage - 1) * pagination.perPage + 1}-
                            {Math.min(currentPage * pagination.perPage, pagination.total)}
                        </span>{" "}
                        {t("leads.of")}{" "}
                        <span className="font-bold text-ink">{pagination.total}</span>
                    </p>
                    <div className="flex overflow-hidden rounded border border-line">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(1)}
                            className="flex h-8 items-center justify-center bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &laquo;
                        </button>
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &lsaquo;
                        </button>
                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                            let pageNum: number;
                            if (pagination.totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= pagination.totalPages - 2)
                                pageNum = pagination.totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`flex h-8 items-center justify-center border-l border-line px-3 text-[14px] ${pageNum === currentPage ? "bg-orange text-white" : "bg-white text-ink-muted hover:bg-surface"}`}>
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &rsaquo;
                        </button>
                        <button
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => handlePageChange(pagination.totalPages)}
                            className="flex h-8 items-center justify-center border-l border-line bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30">
                            &raquo;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
