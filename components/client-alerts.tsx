"use client";

import { AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import Link from "next/link";

import type { AlertType, ClientAlert } from "@/lib/actions/alerts";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";

interface ClientAlertsProps {
    alerts: ClientAlert[];
}

type Translate = (key: TranslationKey) => string;

const alertIcons: Record<string, React.ReactNode> = {
    inactive_user: <Clock className="h-5 w-5" />,
    uncontacted_leads: <Users className="h-5 w-5" />,
    broken_integration: <AlertTriangle className="h-5 w-5" />,
};

const titleKeys: Record<AlertType, TranslationKey> = {
    inactive_user: "alerts.inactive_user.title",
    uncontacted_leads: "alerts.uncontacted_leads.title",
    broken_integration: "alerts.broken_integration.title",
};

/** Fill {placeholders} in a translation template with the given values. */
function fill(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

function alertDescription(t: Translate, alert: ClientAlert): string {
    switch (alert.type) {
        case "inactive_user":
            return alert.days == null
                ? fill(t("alerts.inactive_user.never"), { name: alert.userName ?? "" })
                : fill(t("alerts.inactive_user.days"), {
                      name: alert.userName ?? "",
                      days: alert.days,
                  });
        case "uncontacted_leads":
            return fill(
                t(
                    alert.count === 1
                        ? "alerts.uncontacted_leads.desc_one"
                        : "alerts.uncontacted_leads.desc_other",
                ),
                { client: alert.clientName ?? "", count: alert.count ?? 0, days: alert.days ?? 0 },
            );
        case "broken_integration":
            return fill(
                t(
                    alert.isExpired
                        ? "alerts.broken_integration.expired"
                        : "alerts.broken_integration.disconnected",
                ),
                {
                    client: alert.clientName ?? "",
                    type: (alert.integrationType ?? "").toUpperCase(),
                },
            );
        default:
            return "";
    }
}

function getAlertLink(alert: ClientAlert): string | null {
    switch (alert.type) {
        case "inactive_user":
            return "/admin/users";
        case "uncontacted_leads":
            return alert.clientId ? `/submissions?client=${alert.clientId}` : "/submissions";
        case "broken_integration":
            return alert.clientId ? `/admin/clients/${alert.clientId}` : "/admin/clients";
        default:
            return null;
    }
}

/** Critical/warning count chips — rendered in the card header, top-right. */
export function AlertsSummary({ alerts }: ClientAlertsProps) {
    const { t } = useLanguage();
    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;

    if (criticalCount === 0 && warningCount === 0) return null;

    return (
        <div className="flex shrink-0 items-center gap-3 text-sm">
            {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    {criticalCount} {t("alerts.critical")}
                </span>
            )}
            {warningCount > 0 && (
                <span className="flex items-center gap-1 text-warning">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    {warningCount} {t("alerts.warning")}
                </span>
            )}
        </div>
    );
}

export function ClientAlerts({ alerts }: ClientAlertsProps) {
    const { t } = useLanguage();

    if (alerts.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="mb-2 flex justify-center">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <p className="text-sm font-medium">{t("alerts.all_clear")}</p>
                <p className="text-xs text-muted-foreground">{t("alerts.none")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Alert list */}
            <div className="flex flex-col gap-2">
                {alerts.slice(0, 5).map((alert) => {
                    const link = getAlertLink(alert);
                    const content = (
                        <div
                            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                                alert.severity === "critical"
                                    ? "border-destructive/30 bg-destructive/5"
                                    : "border-warning/30 bg-warning/5"
                            } ${link ? "cursor-pointer hover:bg-muted/50" : ""}`}>
                            <div
                                className={`mt-0.5 ${
                                    alert.severity === "critical"
                                        ? "text-destructive"
                                        : "text-warning"
                                }`}>
                                {alertIcons[alert.type]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{t(titleKeys[alert.type])}</p>
                                <p className="text-xs text-muted-foreground">
                                    {alertDescription(t, alert)}
                                </p>
                            </div>
                        </div>
                    );

                    return link ? (
                        <Link key={alert.id} href={link} className="block">
                            {content}
                        </Link>
                    ) : (
                        <div key={alert.id}>{content}</div>
                    );
                })}
            </div>

            {alerts.length > 5 && (
                <p className="text-center text-xs text-muted-foreground">
                    +{alerts.length - 5} {t("alerts.more")}
                </p>
            )}
        </div>
    );
}
