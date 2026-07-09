"use client";

import {
    ArrowRight,
    ChevronUp,
    Loader2,
    Lock,
    Mail,
    RefreshCw,
    Send,
    Settings2,
    Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { addTicketReplyAction, deleteTicketReplyAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { TicketReplyWithUser } from "@/types/database";

interface TicketRepliesProps {
    ticketId: string;
    replies: TicketReplyWithUser[];
    isAdmin: boolean;
    isClosed: boolean;
    currentUser: { name: string; avatar: string | null };
}

const STATUS_KEYS: Record<string, TranslationKey> = {
    open: "tickets.open",
    in_progress: "tickets.in_progress",
    waiting_on_client: "tickets.waiting_on_client",
    closed: "tickets.closed",
};

const PRIORITY_KEYS: Record<string, TranslationKey> = {
    low: "tickets.priority_low",
    medium: "tickets.priority_medium",
    high: "tickets.priority_high",
    urgent: "tickets.priority_urgent",
};

// Grace period (ms) before a client-facing reply is actually sent — lets the
// author cancel before it leaves (a client-facing reply emails the client).
const UNDO_WINDOW_MS = 5000;

// Collapse long threads: render only the most recent N entries, with a
// "show previous" button. The full set is still fetched server-side.
const VISIBLE_LIMIT = 8;

/** A locally-rendered reply shown immediately, before the server confirms it. */
type OptimisticReply = {
    tempId: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    status: "pending" | "sent";
};

export function TicketReplies({
    ticketId,
    replies,
    isAdmin,
    isClosed,
    currentUser,
}: TicketRepliesProps) {
    const [content, setContent] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Content-driven `disabled` only applies after hydration: it keeps the
    // server/client first render identical (avoids a disabled-attr mismatch,
    // also a frequent symptom of textarea-injecting browser extensions).
    const [mounted, setMounted] = useState(false);
    // Optimistic replies rendered before the server round-trips.
    const [optimistic, setOptimistic] = useState<OptimisticReply[]>([]);
    // Collapsed long threads expand on demand.
    const [showAll, setShowAll] = useState(false);
    const [isSyncing, startSync] = useTransition();
    const router = useRouter();
    const { t } = useLanguage();
    const confirm = useConfirm();
    const seqRef = useRef(0);

    useEffect(() => setMounted(true), []);

    // Server data refreshed → committed optimistic entries are now real; drop them.
    useEffect(() => {
        setOptimistic((prev) => prev.filter((o) => o.status === "pending"));
    }, [replies]);

    function addOptimistic(text: string, internal: boolean): string {
        const tempId = `opt-${(seqRef.current += 1)}`;
        setOptimistic((prev) => [
            ...prev,
            {
                tempId,
                content: text,
                is_internal: internal,
                created_at: new Date().toISOString(),
                status: "pending",
            },
        ]);
        return tempId;
    }

    const markOptimisticSent = (tempId: string) =>
        setOptimistic((prev) =>
            prev.map((o) => (o.tempId === tempId ? { ...o, status: "sent" } : o)),
        );
    const removeOptimistic = (tempId: string) =>
        setOptimistic((prev) => prev.filter((o) => o.tempId !== tempId));

    function syncReplies() {
        startSync(() => router.refresh());
    }

    // Holds a scheduled (not-yet-sent) client-facing reply so we can flush or cancel it.
    const pendingRef = useRef<{
        timeout: ReturnType<typeof setTimeout>;
        interval: ReturnType<typeof setInterval>;
        toastId: string | number;
        text: string;
        tempId: string;
    } | null>(null);

    async function sendReply(text: string, internal: boolean): Promise<boolean> {
        const result = await addTicketReplyAction(ticketId, text, internal);
        if (result.success) {
            router.refresh();
            return true;
        }
        setError(result.error || t("tickets.reply_add_failed"));
        setContent(text); // restore so the author doesn't lose their message
        return false;
    }

    // On unmount, flush any pending reply rather than silently dropping it.
    useEffect(() => {
        return () => {
            const pending = pendingRef.current;
            if (pending) {
                clearTimeout(pending.timeout);
                clearInterval(pending.interval);
                pendingRef.current = null;
                void addTicketReplyAction(ticketId, pending.text, false);
            }
        };
    }, [ticketId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const text = content.trim();
        if (!text) return;
        setError(null);

        // Internal notes stay internal: no email, send immediately.
        if (isInternal) {
            setSubmitting(true);
            setContent("");
            setIsInternal(false);
            const tempId = addOptimistic(text, true);
            const ok = await sendReply(text, true);
            setSubmitting(false);
            if (ok) markOptimisticSent(tempId);
            else removeOptimistic(tempId); // sendReply already restored the input
            return;
        }

        // Client-facing reply: clear the box and open a "undo send" window with a
        // live countdown, since sending will email the client.
        setContent("");
        const tempId = addOptimistic(text, false);
        const toastId = `reply-send-${ticketId}`;
        let remaining = Math.round(UNDO_WINDOW_MS / 1000);

        const paintToast = () =>
            toast(t("tickets.reply_sending_title"), {
                id: toastId,
                description: t("tickets.reply_sending_desc").replace(
                    "{seconds}",
                    String(remaining),
                ),
                icon: <Mail className="size-4" />,
                duration: UNDO_WINDOW_MS,
                action: {
                    label: t("tickets.undo_send"),
                    onClick: () => {
                        const pending = pendingRef.current;
                        if (pending) {
                            clearTimeout(pending.timeout);
                            clearInterval(pending.interval);
                            removeOptimistic(pending.tempId);
                            pendingRef.current = null;
                            setContent(pending.text); // give the message back to edit/resend
                        }
                        toast.info(t("tickets.send_cancelled"), { id: toastId });
                    },
                },
            });

        paintToast();
        const interval = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) paintToast();
        }, 1000);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            pendingRef.current = null;
            markOptimisticSent(tempId);
            void sendReply(text, false).then((ok) => {
                if (!ok) removeOptimistic(tempId);
            });
            toast.success(t("tickets.reply_sent"), { id: toastId });
        }, UNDO_WINDOW_MS);

        pendingRef.current = { timeout, interval, toastId, text, tempId };
    }

    async function handleDelete(replyId: string) {
        const ok = await confirm({
            title: t("tickets.delete_note"),
            description: t("tickets.delete_note_confirm"),
            confirmLabel: t("common.delete"),
            cancelLabel: t("common.cancel"),
            destructive: true,
        });
        if (!ok) return;

        const result = await deleteTicketReplyAction(replyId);
        if (result.success) {
            router.refresh();
        } else {
            toast.error(result.error || t("tickets.note_delete_failed"));
        }
    }

    function systemLine(reply: TicketReplyWithUser): string {
        const { event, from, to } = reply.metadata ?? {};
        // Assignation : `to` est déjà un nom humain (ou null = désassigné).
        if (event === "assigned") {
            return to
                ? `${reply.user_name} ${t("tickets.sys_assigned")} ${to}`
                : `${reply.user_name} ${t("tickets.sys_unassigned")}`;
        }
        const labels = event === "priority_changed" ? PRIORITY_KEYS : STATUS_KEYS;
        const verb =
            event === "priority_changed"
                ? t("tickets.sys_priority_changed")
                : t("tickets.sys_status_changed");
        const fromLabel = from ? ` : ${t(labels[from] ?? "tickets.open")}` : "";
        return `${reply.user_name} ${verb}${fromLabel}`;
    }

    // Collapse long threads to the most recent entries; reveal the rest on demand.
    const visibleReplies = showAll ? replies : replies.slice(-VISIBLE_LIMIT);
    const hiddenCount = replies.length - visibleReplies.length;
    const replyCount = replies.filter((r) => r.kind !== "system").length;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                    {t("tickets.replies")} ({replyCount})
                </CardTitle>
                <button
                    type="button"
                    onClick={syncReplies}
                    disabled={isSyncing}
                    title={t("tickets.refresh")}
                    aria-label={t("tickets.refresh")}
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                    <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
                </button>
            </CardHeader>
            <CardContent className="space-y-4">
                {replies.length === 0 && optimistic.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("tickets.no_replies")}</p>
                )}

                {hiddenCount > 0 && !showAll && (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <ChevronUp className="size-3.5" />
                        {t("tickets.show_previous").replace("{count}", String(hiddenCount))}
                    </button>
                )}

                {visibleReplies.map((reply) =>
                    reply.kind === "system" ? (
                        // System event: subtle, centered technical trace line.
                        <div
                            key={reply.id}
                            className="flex flex-wrap items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
                            <Settings2 className="size-3 shrink-0" />
                            <span>{systemLine(reply)}</span>
                            {reply.metadata?.event !== "assigned" && reply.metadata?.to && (
                                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                    <ArrowRight className="size-3" />
                                    {t(
                                        (reply.metadata.event === "priority_changed"
                                            ? PRIORITY_KEYS
                                            : STATUS_KEYS)[reply.metadata.to] ?? "tickets.open",
                                    )}
                                </span>
                            )}
                            <span suppressHydrationWarning title={formatDateTime(reply.created_at)}>
                                · {timeAgo(reply.created_at)}
                            </span>
                        </div>
                    ) : (
                        <div
                            key={reply.id}
                            className={`rounded-lg border p-4 ${
                                reply.is_internal
                                    ? "border-yellow-200 bg-yellow-50"
                                    : reply.user_role === "admin"
                                      ? "border-blue-200 bg-blue-50"
                                      : "border-border bg-background"
                            }`}>
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Avatar
                                        name={reply.user_name}
                                        src={reply.user_avatar}
                                        size="xs"
                                    />
                                    <span className="text-sm font-medium">{reply.user_name}</span>
                                    {reply.user_role === "admin" && (
                                        <Badge variant="secondary">Admin</Badge>
                                    )}
                                    {reply.is_internal && (
                                        <Badge variant="warning">
                                            {t("tickets.internal_note")}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-xs text-muted-foreground"
                                        suppressHydrationWarning
                                        title={formatDateTime(reply.created_at)}>
                                        {timeAgo(reply.created_at)}
                                    </span>
                                    {/* Admins may delete internal notes only. */}
                                    {isAdmin && reply.is_internal && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(reply.id)}
                                            aria-label={t("tickets.delete_note")}
                                            title={t("tickets.delete_note")}
                                            className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive">
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="whitespace-pre-wrap text-sm">{reply.content}</p>
                        </div>
                    ),
                )}

                {/* Optimistic replies: shown immediately, reconciled on refresh. */}
                {optimistic.map((o) => (
                    <div
                        key={o.tempId}
                        className={cn(
                            "rounded-lg border p-4 opacity-60",
                            o.is_internal
                                ? "border-yellow-200 bg-yellow-50"
                                : isAdmin
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-border bg-background",
                        )}>
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Avatar
                                    name={currentUser.name}
                                    src={currentUser.avatar}
                                    size="xs"
                                />
                                <span className="text-sm font-medium">{currentUser.name}</span>
                                {isAdmin && <Badge variant="secondary">Admin</Badge>}
                                {o.is_internal && (
                                    <Badge variant="warning">{t("tickets.internal_note")}</Badge>
                                )}
                            </div>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" />
                                {t("tickets.sending")}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{o.content}</p>
                    </div>
                ))}

                {/* Reply composer: avatar + mode tabs + contextual hint */}
                {!isClosed && (
                    <div className="flex gap-3 border-t border-border pt-4">
                        {/* Author avatar */}
                        <Avatar name={currentUser.name} src={currentUser.avatar} size="md" />

                        <form onSubmit={handleSubmit} className="min-w-0 flex-1">
                            <div
                                className={cn(
                                    "overflow-hidden rounded-xl border transition-colors",
                                    isInternal
                                        ? "border-yellow-300 bg-yellow-50/60"
                                        : "border-border bg-background focus-within:border-brand/60",
                                )}>
                                {/* Mode tabs (admin only) */}
                                {isAdmin && (
                                    <div className="flex border-b border-inherit">
                                        <button
                                            type="button"
                                            onClick={() => setIsInternal(false)}
                                            aria-pressed={!isInternal}
                                            className={cn(
                                                "flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors",
                                                !isInternal
                                                    ? "border-brand text-foreground"
                                                    : "border-transparent text-muted-foreground hover:text-foreground",
                                            )}>
                                            <Mail className="size-3.5" />
                                            {t("tickets.reply_to_client")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsInternal(true)}
                                            aria-pressed={isInternal}
                                            className={cn(
                                                "flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors",
                                                isInternal
                                                    ? "border-yellow-500 text-yellow-800"
                                                    : "border-transparent text-muted-foreground hover:text-foreground",
                                            )}>
                                            <Lock className="size-3.5" />
                                            {t("tickets.internal_note")}
                                        </button>
                                    </div>
                                )}

                                <textarea
                                    suppressHydrationWarning
                                    placeholder={t("tickets.reply_placeholder")}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Ctrl/Cmd+Enter sends (respects native form validation).
                                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                            e.preventDefault();
                                            e.currentTarget.form?.requestSubmit();
                                        }
                                    }}
                                    rows={3}
                                    required
                                    className="block w-full resize-none bg-transparent px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />

                                {/* Footer: contextual hint + send */}
                                <div className="flex items-center justify-between gap-2 px-3 py-2">
                                    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                        {isInternal ? (
                                            <>
                                                <Lock className="size-3 shrink-0" />
                                                <span className="truncate">
                                                    {t("tickets.internal_only_hint")}
                                                </span>
                                            </>
                                        ) : isAdmin ? (
                                            <>
                                                <Mail className="size-3 shrink-0" />
                                                <span className="truncate">
                                                    {t("tickets.client_will_be_notified")}
                                                </span>
                                            </>
                                        ) : null}
                                    </p>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={submitting || (mounted && !content.trim())}
                                        className="shrink-0 gap-1.5 bg-orange text-white hover:bg-orange-dark active:bg-orange-dark">
                                        <Send className="size-3.5" />
                                        {submitting
                                            ? t("tickets.sending")
                                            : t("tickets.send_reply")}
                                    </Button>
                                </div>
                            </div>
                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                        </form>
                    </div>
                )}

                {isClosed && (
                    <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
                        {t("tickets.closed_message")}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
