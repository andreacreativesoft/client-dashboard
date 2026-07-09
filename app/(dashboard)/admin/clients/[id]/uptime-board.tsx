"use client";

import { Activity, AlertTriangle, CheckCircle2, PowerOff, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { getUptimeForWebsite, type UptimeStatus, type UptimeSummary } from "@/lib/actions/uptime";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const STATUS_META: Record<
    UptimeStatus,
    { label: string; dot: string; text: string; bg: string; Icon: typeof CheckCircle2 }
> = {
    up: {
        label: "En ligne",
        dot: "bg-success",
        text: "text-success",
        bg: "bg-success/10",
        Icon: CheckCircle2,
    },
    degraded: {
        label: "Dégradé",
        dot: "bg-warning",
        text: "text-warning",
        bg: "bg-warning/10",
        Icon: AlertTriangle,
    },
    down: {
        label: "Hors ligne",
        dot: "bg-destructive",
        text: "text-destructive",
        bg: "bg-destructive/10",
        Icon: XCircle,
    },
};

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
        </div>
    );
}

export function UptimeBoard({ websiteId }: { websiteId: string }) {
    const [data, setData] = useState<UptimeSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        getUptimeForWebsite(websiteId).then((d) => {
            if (alive) {
                setData(d);
                setLoading(false);
            }
        });
        return () => {
            alive = false;
        };
    }, [websiteId]);

    if (loading || !data) {
        return <p className="text-xs text-muted-foreground">Chargement…</p>;
    }

    if (!data.enabled) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                <PowerOff className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Surveillance désactivée pour ce site.
                </p>
                <p className="text-xs text-muted-foreground">
                    Activez-la via « Gérer › Modifier le site ».
                </p>
            </div>
        );
    }

    if (!data.latest) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                <Activity className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Surveillance activée — aucune mesure pour l'instant.
                </p>
            </div>
        );
    }

    const meta = STATUS_META[data.latest.status];
    const StatusIcon = meta.Icon;

    return (
        <div className="space-y-4">
            {/* Current status */}
            <div className={cn("flex items-center gap-3 rounded-lg p-4", meta.bg)}>
                <StatusIcon className={cn("size-7 shrink-0", meta.text)} />
                <div className="min-w-0">
                    <p className={cn("text-base font-semibold", meta.text)}>{meta.label}</p>
                    <p
                        className="text-xs text-muted-foreground"
                        title={formatDateTime(data.latest.checked_at)}>
                        Vérifié {timeAgo(data.latest.checked_at)}
                    </p>
                </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-2">
                <Metric
                    label={`Dispo. ${data.windowDays} j`}
                    value={data.uptimePct !== null ? `${data.uptimePct} %` : "—"}
                />
                <Metric
                    label="Réponse"
                    value={
                        data.latest.response_ms !== null
                            ? `${data.latest.response_ms} ms`
                            : data.avgResponseMs !== null
                              ? `${data.avgResponseMs} ms`
                              : "—"
                    }
                />
                <Metric
                    label="Code HTTP"
                    value={data.latest.http_status !== null ? String(data.latest.http_status) : "—"}
                />
            </div>

            {data.latest.error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {data.latest.error}
                </p>
            )}

            {/* Recent incidents */}
            {data.recentIncidents.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Incidents récents
                        {data.openIncidents > 0 && (
                            <span className="ml-1.5 text-destructive">
                                · {data.openIncidents} en cours
                            </span>
                        )}
                    </p>
                    {data.recentIncidents.map((inc, i) => {
                        const incMeta = STATUS_META[inc.last_status];
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5 text-xs">
                                <span className={cn("size-2 shrink-0 rounded-full", incMeta.dot)} />
                                <span className="font-medium">{incMeta.label}</span>
                                <span
                                    className="ml-auto text-muted-foreground"
                                    title={formatDateTime(inc.started_at)}>
                                    {inc.resolved_at ? "résolu" : "depuis"}{" "}
                                    {timeAgo(inc.resolved_at ?? inc.started_at)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
