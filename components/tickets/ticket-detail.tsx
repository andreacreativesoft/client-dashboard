import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { fieldOptionLabel, getTicketType, tr } from "@/lib/tickets/ticket-types";
import { formatDate, formatDateTime, timeAgoIntl } from "@/lib/utils";
import type { AppLanguage, TicketReplyWithUser, TicketWithDetails } from "@/types/database";

import { CollapsibleText } from "./collapsible-text";
import { TicketAssignControl } from "./ticket-assign-control";
import { TicketPriorityControl } from "./ticket-priority-control";
import { TicketReplies } from "./ticket-replies";
import { TicketStatusControl } from "./ticket-status-control";

// Statut = tons froids/neutres (workflow), pour ne pas concurrencer la gravité.
const STATUS_COLORS: Record<string, string> = {
    open: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    waiting_on_client: "bg-violet-100 text-violet-700",
    closed: "bg-muted text-muted-foreground",
};

const STATUS_KEY: Record<string, TranslationKey> = {
    open: "tickets.open",
    in_progress: "tickets.in_progress",
    waiting_on_client: "tickets.waiting_on_client",
    closed: "tickets.closed",
};

// Priorité = échelle de chaleur (gravité) : neutre → ambre → orange → rouge.
const PRIORITY_COLORS: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-amber-50 text-amber-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
};

const PRIORITY_KEY: Record<string, TranslationKey> = {
    low: "tickets.priority_low",
    medium: "tickets.priority_medium",
    high: "tickets.priority_high",
    urgent: "tickets.priority_urgent",
};

type TicketDetailProps = {
    ticket: TicketWithDetails;
    replies: TicketReplyWithUser[];
    /** Client's websites — only shown in the admin view. */
    websites: { id: string; name: string; url: string }[];
    isAdmin: boolean;
    lang: AppLanguage;
    backHref: string;
    backLabel: string;
    /** The logged-in author, shown in the reply composer. */
    currentUser: { name: string; avatar: string | null };
    /** Agency members for the assignment control (admin view only). */
    adminUsers: { id: string; full_name: string }[];
};

export function TicketDetail({
    ticket,
    replies,
    websites,
    isAdmin,
    lang,
    backHref,
    backLabel,
    currentUser,
    adminUsers,
}: TicketDetailProps) {
    return (
        <PageContainer>
            <div className="mb-6">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                </Link>
            </div>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-[26px] font-bold leading-none tabular-nums text-ink-muted">
                            #{ticket.number}
                        </span>
                        <h1 className="text-3xl font-bold">{ticket.subject}</h1>
                        {/* Status badge: only for clients — admins get the inline status selector beside the title. */}
                        {!isAdmin && (
                            <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ticket.status] || "bg-muted text-muted-foreground"}`}>
                                {t(lang, STATUS_KEY[ticket.status] ?? "tickets.open")}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t(lang, "tickets.created")} {timeAgoIntl(ticket.created_at, lang)}{" "}
                        {t(lang, "tickets.by")} {ticket.created_by_name}
                    </p>
                </div>
                {isAdmin && (
                    <TicketStatusControl ticketId={ticket.id} currentStatus={ticket.status} />
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    {/* Détails de la demande — rendu structuré dans la langue du lecteur,
                        fallback texte brut pour les tickets sans champs (ex. chat). */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "tickets.request_details")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TicketDetailsBody ticket={ticket} lang={lang} />
                        </CardContent>
                    </Card>

                    {/* Replies */}
                    <TicketReplies
                        ticketId={ticket.id}
                        replies={replies}
                        isAdmin={isAdmin}
                        isClosed={ticket.status === "closed"}
                        currentUser={currentUser}
                    />
                </div>

                <div className="space-y-6">
                    {/* Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "tickets.details")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {isAdmin && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "tickets.client")}
                                    </p>
                                    <Link
                                        href={`/admin/clients/${ticket.client_id}`}
                                        className="text-sm text-blue-600 hover:underline">
                                        {ticket.client_name}
                                    </Link>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.created_by")}
                                </p>
                                <p className="text-sm">{ticket.created_by_name}</p>
                            </div>
                            {isAdmin && websites.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "tickets.website")}
                                    </p>
                                    {websites.map((w) => (
                                        <a
                                            key={w.id}
                                            href={w.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block text-sm text-blue-600 hover:underline">
                                            {w.name || w.url}
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.type")}
                                </p>
                                <p className="text-sm">
                                    {getTicketType(ticket.type)
                                        ? tr(getTicketType(ticket.type)!.label, lang)
                                        : ticket.type}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.priority")}
                                </p>
                                {isAdmin ? (
                                    <TicketPriorityControl
                                        ticketId={ticket.id}
                                        currentPriority={ticket.priority}
                                    />
                                ) : (
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                                        {t(
                                            lang,
                                            PRIORITY_KEY[ticket.priority] ?? "tickets.priority_low",
                                        )}
                                    </span>
                                )}
                            </div>
                            {/* Assignation : éditable par l'admin, lue par le client. */}
                            {(isAdmin || ticket.assigned_to_name) && (
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                        {isAdmin
                                            ? t(lang, "tickets.assigned_to")
                                            : t(lang, "tickets.your_contact")}
                                    </p>
                                    {isAdmin ? (
                                        <TicketAssignControl
                                            ticketId={ticket.id}
                                            currentAssignedTo={ticket.assigned_to}
                                            adminUsers={adminUsers}
                                        />
                                    ) : (
                                        <p className="text-sm">{ticket.assigned_to_name}</p>
                                    )}
                                </div>
                            )}
                            {ticket.due_date && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "tickets.due_date")}
                                    </p>
                                    <p className="text-sm">{formatDate(ticket.due_date)}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "tickets.timeline")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.created")}
                                </p>
                                <p
                                    className="text-sm"
                                    suppressHydrationWarning
                                    title={formatDateTime(ticket.created_at)}>
                                    {timeAgoIntl(ticket.created_at, lang)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.last_updated")}
                                </p>
                                <p
                                    className="text-sm"
                                    suppressHydrationWarning
                                    title={formatDateTime(ticket.updated_at)}>
                                    {timeAgoIntl(ticket.updated_at, lang)}
                                </p>
                            </div>
                            {ticket.closed_at && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "tickets.closed")}
                                    </p>
                                    <p
                                        className="text-sm"
                                        suppressHydrationWarning
                                        title={formatDateTime(ticket.closed_at)}>
                                        {timeAgoIntl(ticket.closed_at, lang)}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "tickets.replies")}
                                </p>
                                <p className="text-sm">
                                    {replies.filter((r) => r.kind !== "system").length}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageContainer>
    );
}

/** Liens cliquables pour les champs url / url_list, texte sinon. */
function DetailValue({ type, value }: { type: string; value: string }) {
    if (type === "url" || type === "url_list") {
        const urls = value
            .split(/\r?\n/)
            .map((u) => u.trim())
            .filter(Boolean);
        return (
            <span className="flex flex-col gap-0.5">
                {urls.map((u, i) => (
                    <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-sm text-blue-600 hover:underline">
                        {u}
                    </a>
                ))}
            </span>
        );
    }
    return <span className="whitespace-pre-wrap text-sm">{value}</span>;
}

/**
 * Détails de la demande : champs du type rendus dans la langue du lecteur.
 * Fallback texte brut pour les tickets sans champs structurés (chat, legacy).
 */
function TicketDetailsBody({ ticket, lang }: { ticket: TicketWithDetails; lang: AppLanguage }) {
    const reqType = getTicketType(ticket.type);
    const entries = reqType
        ? reqType.fields
              .map((f) => {
                  const raw = (ticket.details?.[f.key] ?? "").trim();
                  if (!raw) return null;
                  const value = f.type === "select" ? fieldOptionLabel(f, raw, lang) : raw;
                  return { key: f.key, label: tr(f.label, lang), value, type: f.type };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null)
        : [];

    if (entries.length === 0) {
        return <CollapsibleText text={ticket.description} />;
    }

    return (
        <dl className="space-y-4">
            {entries.map((e) => (
                <div key={e.key}>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                        {e.label}
                    </dt>
                    <dd className="mt-0.5">
                        <DetailValue type={e.type} value={e.value} />
                    </dd>
                </div>
            ))}
        </dl>
    );
}
