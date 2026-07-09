"use client";

import { Check, ExternalLink, MessageSquare, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
    createTicketAction,
    getRecentTicketsForClient,
    type ChatTicketSummary,
} from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types/database";

interface SupportChatProps {
    userId: string;
    userRole: "admin" | "client";
    clientId: string | null;
    openTicketCount: number;
}

const STATUS_LABEL: Record<TicketStatus, TranslationKey> = {
    open: "tickets.open",
    in_progress: "tickets.in_progress",
    waiting_on_client: "tickets.waiting_on_client",
    closed: "tickets.closed",
};

const STATUS_STYLE: Record<TicketStatus, string> = {
    open: "bg-orange-soft text-orange",
    in_progress: "bg-brand-soft text-brand",
    waiting_on_client: "bg-green-soft text-green",
    closed: "bg-muted text-muted-foreground",
};

export function SupportChat({
    userId: _userId,
    userRole,
    clientId,
    openTicketCount,
}: SupportChatProps) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [tickets, setTickets] = useState<ChatTicketSummary[]>([]);
    const [loading, setLoading] = useState(false);

    // Quick-create form
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadTickets = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        const recent = await getRecentTicketsForClient(clientId);
        setTickets(recent);
        setLoading(false);
    }, [clientId]);

    useEffect(() => {
        if (isOpen) loadTickets();
    }, [isOpen, loadTickets]);

    const openPanel = () => {
        setIsOpen(true);
        setSubmitted(false);
        setError(null);
    };

    const submitTicket = async () => {
        if (!subject.trim() || !message.trim() || !clientId || sending) return;

        setSending(true);
        setError(null);

        const result = await createTicketAction({
            client_id: clientId,
            type: "other",
            details: { title: subject.trim(), message: message.trim() },
            priority: "medium",
        });

        if (result.success) {
            setSubmitted(true);
            setSubject("");
            setMessage("");
            loadTickets();
        } else {
            setError(result.error || t("chat.request_failed"));
        }
        setSending(false);
    };

    // ─── Admin view: badge + link to tickets ──────────────────────────
    if (userRole === "admin") {
        return (
            <a
                href="/tickets?status=open"
                className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6"
                title={`${openTicketCount} ${t("chat.open_tickets")}`}>
                <MessageSquare className="h-6 w-6" />
                {openTicketCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                        {openTicketCount > 99 ? "99+" : openTicketCount}
                    </span>
                )}
            </a>
        );
    }

    // ─── Client view: help / requests shortcut ────────────────────────
    return (
        <>
            {/* Floating bubble */}
            {!isOpen && (
                <button
                    onClick={openPanel}
                    className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6"
                    title={t("chat.support")}>
                    <MessageSquare className="h-6 w-6" />
                    {openTicketCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                            {openTicketCount > 99 ? "99+" : openTicketCount}
                        </span>
                    )}
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-0 right-0 z-50 flex h-[100dvh] w-full flex-col border-l border-border bg-background shadow-2xl md:bottom-6 md:right-6 md:h-[560px] md:w-[380px] md:rounded-2xl md:border">
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                <MessageSquare className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">{t("chat.support")}</p>
                                <p className="text-xs text-muted-foreground">{t("chat.intro")}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        {!clientId ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {t("chat.no_client")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Recent requests */}
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {t("chat.recent_requests")}
                                    </p>
                                    {loading ? (
                                        <div className="flex justify-center py-4">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        </div>
                                    ) : tickets.length === 0 ? (
                                        <p className="py-2 text-sm text-muted-foreground">
                                            {t("chat.no_requests")}
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {tickets.map((ticket) => (
                                                <li key={ticket.id}>
                                                    <Link
                                                        href={`/tickets/${ticket.id}`}
                                                        onClick={() => setIsOpen(false)}
                                                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted">
                                                        <span className="min-w-0 flex-1 truncate text-sm">
                                                            <span className="text-muted-foreground">
                                                                #{ticket.number}
                                                            </span>{" "}
                                                            {ticket.subject}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                                                STATUS_STYLE[ticket.status],
                                                            )}>
                                                            {t(STATUS_LABEL[ticket.status])}
                                                        </span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* New request */}
                                <div className="space-y-3 border-t border-border pt-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {t("chat.new_request_title")}
                                    </p>

                                    {submitted ? (
                                        <div className="flex flex-col items-center gap-3 py-4 text-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-soft">
                                                <Check className="h-6 w-6 text-green" />
                                            </div>
                                            <p className="text-sm font-medium">
                                                {t("chat.ticket_submitted")}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t("chat.we_reply_soon")}
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSubmitted(false)}>
                                                {t("chat.send_another")}
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                placeholder={t("chat.subject_placeholder")}
                                                maxLength={200}
                                                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                            />
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder={t("chat.message_placeholder")}
                                                rows={4}
                                                maxLength={10000}
                                                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                            />
                                            {error && (
                                                <p className="text-xs text-red-600">{error}</p>
                                            )}
                                            <Button
                                                onClick={submitTicket}
                                                disabled={
                                                    !subject.trim() || !message.trim() || sending
                                                }
                                                className="w-full">
                                                {sending ? (
                                                    t("chat.submitting")
                                                ) : (
                                                    <>
                                                        <Plus className="mr-1 h-4 w-4" />
                                                        {t("chat.submit_ticket")}
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="border-t border-border p-3">
                        <Link
                            href="/tickets"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
                            <ExternalLink className="h-4 w-4" />
                            {t("chat.view_all_tickets")}
                        </Link>
                    </div>
                </div>
            )}
        </>
    );
}
