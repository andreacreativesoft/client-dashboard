"use client";

import { formatDistanceToNow } from "date-fns";
import {
    BarChart3,
    Braces,
    Building2,
    Clock,
    Globe,
    Mail,
    MessageSquare,
    RefreshCw,
    UserPlus,
} from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { ActivityTypes } from "@/lib/constants/activity";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatDateTime } from "@/lib/utils";
import type { ActivityLogWithUser } from "@/types/database";

interface ActivityLogProps {
    activities: ActivityLogWithUser[];
    showClient?: boolean;
}

type Translate = (key: TranslationKey) => string;

const ICON_CLASS = "h-4 w-4";

const actionIcons: Record<string, React.ReactNode> = {
    [ActivityTypes.SUBMISSION_CREATED]: <UserPlus className={ICON_CLASS} />,
    [ActivityTypes.SUBMISSION_STATUS_CHANGED]: <RefreshCw className={ICON_CLASS} />,
    [ActivityTypes.SUBMISSION_NOTE_ADDED]: <MessageSquare className={ICON_CLASS} />,
    [ActivityTypes.CONNECTOR_CREATED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.CONNECTOR_UPDATED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.CONNECTOR_DELETED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.TICKET_CREATED]: <MessageSquare className={ICON_CLASS} />,
    [ActivityTypes.TICKET_REPLIED]: <MessageSquare className={ICON_CLASS} />,
    [ActivityTypes.TICKET_STATUS_CHANGED]: <RefreshCw className={ICON_CLASS} />,
    [ActivityTypes.CLIENT_CREATED]: <Building2 className={ICON_CLASS} />,
    [ActivityTypes.CLIENT_UPDATED]: <Building2 className={ICON_CLASS} />,
    [ActivityTypes.WEBSITE_ADDED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.WEBSITE_UPDATED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.WEBSITE_REMOVED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.ATTRIBUTE_ADDED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.ATTRIBUTE_UPDATED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.ATTRIBUTE_REMOVED]: <Globe className={ICON_CLASS} />,
    [ActivityTypes.USER_INVITED]: <UserPlus className={ICON_CLASS} />,
    [ActivityTypes.USER_JOINED]: <UserPlus className={ICON_CLASS} />,
    [ActivityTypes.USER_ASSIGNED]: <UserPlus className={ICON_CLASS} />,
    [ActivityTypes.USER_REMOVED]: <UserPlus className={ICON_CLASS} />,
    [ActivityTypes.ANALYTICS_SYNCED]: <BarChart3 className={ICON_CLASS} />,
    [ActivityTypes.INTEGRATION_CONNECTED]: <RefreshCw className={ICON_CLASS} />,
    [ActivityTypes.INTEGRATION_DISCONNECTED]: <RefreshCw className={ICON_CLASS} />,
    [ActivityTypes.EMAIL_SENT]: <Mail className={ICON_CLASS} />,
};

const defaultIcon = <Clock className={ICON_CLASS} />;

// Status enum value → i18n label key (so descriptions stay translated/relabeled).
const STATUS_LABEL_KEY: Record<string, TranslationKey> = {
    new: "leads.new",
    contacted: "leads.contacted",
    done: "leads.done",
    open: "tickets.open",
    in_progress: "tickets.in_progress",
    waiting_on_client: "tickets.waiting_on_client",
    closed: "tickets.closed",
};

/** Fill {placeholders} in a template with the given values. */
function fill(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Build the localized description from action_type + metadata. Falls back to the
 * stored `description` for legacy/seed rows that predate structured metadata.
 */
function describe(t: Translate, activity: ActivityLogWithUser): string {
    const meta = (activity.metadata ?? {}) as Record<string, unknown>;
    const get = (key: string) => (meta[key] == null ? "" : String(meta[key]));
    const statusLabel = () => {
        const s = get("status");
        return s && STATUS_LABEL_KEY[s] ? t(STATUS_LABEL_KEY[s]) : s;
    };

    switch (activity.action_type) {
        case ActivityTypes.SUBMISSION_CREATED:
            return fill(t("activity.lead_created"), { name: get("submissionName") });
        case ActivityTypes.SUBMISSION_STATUS_CHANGED:
            return fill(t("activity.lead_status_changed"), {
                name: get("submissionName"),
                status: statusLabel(),
            });
        case ActivityTypes.SUBMISSION_NOTE_ADDED:
            return fill(t("activity.lead_note_added"), { name: get("submissionName") });
        case ActivityTypes.TICKET_CREATED:
            return fill(t("activity.ticket_created"), {
                number: get("number"),
                subject: get("subject"),
            });
        case ActivityTypes.TICKET_REPLIED:
            return fill(t("activity.ticket_replied"), { number: get("number") });
        case ActivityTypes.TICKET_STATUS_CHANGED:
            return fill(t("activity.ticket_status_changed"), {
                number: get("number"),
                status: statusLabel(),
            });
        case ActivityTypes.CLIENT_CREATED:
            return fill(t("activity.client_created"), { name: get("clientName") });
        case ActivityTypes.CLIENT_UPDATED:
            return fill(t("activity.client_updated"), { name: get("clientName") });
        case ActivityTypes.WEBSITE_ADDED:
            return fill(t("activity.website_added"), { name: get("websiteName") });
        case ActivityTypes.WEBSITE_REMOVED:
            return fill(t("activity.website_removed"), { name: get("websiteName") });
        case ActivityTypes.USER_INVITED:
            return fill(t("activity.user_invited"), { name: get("userName") });
        case ActivityTypes.USER_JOINED:
            return fill(t("activity.user_joined"), { name: get("userName") });
        case ActivityTypes.USER_ASSIGNED:
            return fill(t("activity.user_assigned"), { name: get("userName") });
        case ActivityTypes.USER_REMOVED:
            return fill(t("activity.user_removed"), { name: get("userName") });
        case ActivityTypes.INTEGRATION_CONNECTED:
            return fill(t("activity.integration_connected"), {
                type: get("integrationType").toUpperCase(),
            });
        case ActivityTypes.INTEGRATION_DISCONNECTED:
            return fill(t("activity.integration_disconnected"), {
                type: get("integrationType").toUpperCase(),
            });
        case ActivityTypes.EMAIL_SENT:
            return fill(t("activity.email_sent"), { name: get("email") });
        default:
            return activity.description;
    }
}

const PLATFORM_LABELS: Record<string, string> = { wordpress: "WordPress", custom: "Sur-mesure" };

/**
 * Type-specific secondary line surfacing the most useful stored metadata that
 * the main description doesn't already show (URL, access role, email subject…).
 */
function extraInfo(t: Translate, activity: ActivityLogWithUser): string | null {
    const meta = (activity.metadata ?? {}) as Record<string, unknown>;
    const get = (key: string) => (meta[key] == null ? "" : String(meta[key]));

    switch (activity.action_type) {
        case ActivityTypes.WEBSITE_ADDED: {
            const platform = get("platform");
            return (
                [get("url"), PLATFORM_LABELS[platform] ?? platform].filter(Boolean).join(" · ") ||
                null
            );
        }
        case ActivityTypes.WEBSITE_UPDATED:
            return get("websiteName") || null;
        case ActivityTypes.CONNECTOR_CREATED:
            return get("name") || null;
        case ActivityTypes.ATTRIBUTE_ADDED:
            return get("title") || null;
        case ActivityTypes.USER_ASSIGNED: {
            const role = get("accessRole");
            if (role === "owner") return t("activity.role_owner");
            if (role === "viewer") return t("activity.role_viewer");
            return role || null;
        }
        case ActivityTypes.EMAIL_SENT: {
            const subject = get("subject");
            return subject ? `${t("activity.subject")} : ${subject}` : null;
        }
        case ActivityTypes.TICKET_REPLIED:
            return meta.isInternal ? t("tickets.internal_note") : t("activity.client_reply");
        default:
            return null;
    }
}

export function ActivityLog({ activities, showClient = false }: ActivityLogProps) {
    const { t } = useLanguage();
    const [detail, setDetail] = useState<ActivityLogWithUser | null>(null);

    if (activities.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map((activity) => (
                <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {actionIcons[activity.action_type] || defaultIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm">{describe(t, activity)}</p>
                        {extraInfo(t, activity) && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {extraInfo(t, activity)}
                            </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {showClient && activity.client_name && (
                                <>
                                    <span className="font-medium text-foreground">
                                        {activity.client_name}
                                    </span>
                                    <span aria-hidden>·</span>
                                </>
                            )}
                            {activity.user_name && (
                                <span className="font-medium">{activity.user_name}</span>
                            )}
                            <span>
                                {formatDistanceToNow(new Date(activity.created_at), {
                                    addSuffix: true,
                                })}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setDetail(activity)}
                        aria-label={t("activity.technical_details")}
                        title={t("activity.technical_details")}
                        className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Braces className="size-4" />
                    </button>
                </div>
            ))}

            <Modal
                open={detail !== null}
                onClose={() => setDetail(null)}
                title={t("activity.technical_details")}>
                {detail && (
                    <div className="space-y-4">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <dt className="text-muted-foreground">Type</dt>
                            <dd className="break-all font-mono text-xs">{detail.action_type}</dd>
                            <dt className="text-muted-foreground">Date</dt>
                            <dd>{formatDateTime(detail.created_at)}</dd>
                            {detail.client_name && (
                                <>
                                    <dt className="text-muted-foreground">Client</dt>
                                    <dd>{detail.client_name}</dd>
                                </>
                            )}
                            {detail.user_name && (
                                <>
                                    <dt className="text-muted-foreground">Utilisateur</dt>
                                    <dd>
                                        {detail.user_name}
                                        {detail.user_email ? ` · ${detail.user_email}` : ""}
                                    </dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">ID</dt>
                            <dd className="break-all font-mono text-xs">{detail.id}</dd>
                        </dl>

                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
                                {t("activity.metadata")}
                            </p>
                            <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                                {JSON.stringify(detail.metadata ?? {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
