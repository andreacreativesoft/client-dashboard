"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateTicketStatusAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { TicketStatus } from "@/types/database";

interface TicketStatusControlProps {
    ticketId: string;
    currentStatus: TicketStatus;
}

const STATUS_OPTIONS: {
    value: TicketStatus;
    labelKey: TranslationKey;
    color: string;
    activeColor: string;
}[] = [
    // Tons froids/neutres : le statut décrit l'étape, pas la gravité.
    {
        value: "open",
        labelKey: "tickets.open",
        color: "border-slate-300 text-slate-600 hover:bg-slate-50",
        activeColor: "bg-slate-600 text-white border-slate-600",
    },
    {
        value: "in_progress",
        labelKey: "tickets.in_progress",
        color: "border-blue-300 text-blue-600 hover:bg-blue-50",
        activeColor: "bg-blue-500 text-white border-blue-500",
    },
    {
        value: "waiting_on_client",
        labelKey: "tickets.waiting_on_client",
        color: "border-violet-300 text-violet-600 hover:bg-violet-50",
        activeColor: "bg-violet-500 text-white border-violet-500",
    },
    {
        value: "closed",
        labelKey: "tickets.closed",
        color: "border-emerald-300 text-emerald-600 hover:bg-emerald-50",
        activeColor: "bg-emerald-500 text-white border-emerald-500",
    },
];

export function TicketStatusControl({ ticketId, currentStatus }: TicketStatusControlProps) {
    const [updating, setUpdating] = useState(false);
    const router = useRouter();
    const { t } = useLanguage();

    async function handleStatusChange(newStatus: TicketStatus) {
        if (newStatus === currentStatus) return;
        setUpdating(true);
        await updateTicketStatusAction(ticketId, newStatus);
        router.refresh();
        setUpdating(false);
    }

    return (
        <div className="flex rounded-lg border border-border overflow-hidden">
            {STATUS_OPTIONS.map((status) => (
                <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    disabled={updating}
                    aria-pressed={currentStatus === status.value}
                    aria-label={t(status.labelKey)}
                    className={`cursor-pointer px-4 py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:py-1.5 sm:text-xs ${
                        currentStatus === status.value
                            ? status.activeColor
                            : status.color + " bg-background"
                    }`}>
                    {t(status.labelKey)}
                </button>
            ))}
        </div>
    );
}
