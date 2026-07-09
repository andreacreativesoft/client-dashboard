"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateTicketAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { TicketPriority } from "@/types/database";

interface TicketPriorityControlProps {
    ticketId: string;
    currentPriority: TicketPriority;
}

const PRIORITY_OPTIONS: {
    value: TicketPriority;
    labelKey: TranslationKey;
    badge: string;
}[] = [
    { value: "low", labelKey: "tickets.priority_low", badge: "bg-muted text-muted-foreground" },
    { value: "medium", labelKey: "tickets.priority_medium", badge: "bg-amber-50 text-amber-700" },
    { value: "high", labelKey: "tickets.priority_high", badge: "bg-orange-100 text-orange-700" },
    { value: "urgent", labelKey: "tickets.priority_urgent", badge: "bg-red-100 text-red-700" },
];

export function TicketPriorityControl({ ticketId, currentPriority }: TicketPriorityControlProps) {
    const [updating, setUpdating] = useState(false);
    const router = useRouter();
    const { t } = useLanguage();

    const current = PRIORITY_OPTIONS.find((p) => p.value === currentPriority) ?? {
        value: "low" as TicketPriority,
        labelKey: "tickets.priority_low" as TranslationKey,
        badge: "bg-muted text-muted-foreground",
    };

    async function handlePriorityChange(value: string) {
        const next = value as TicketPriority;
        if (next === currentPriority) return;
        setUpdating(true);
        await updateTicketAction(ticketId, { priority: next });
        router.refresh();
        setUpdating(false);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={updating}
                aria-label={t("tickets.priority")}
                className="group inline-flex items-center gap-1 rounded-full outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
                <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${current.badge}`}>
                    {t(current.labelKey)}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuRadioGroup
                    value={currentPriority}
                    onValueChange={handlePriorityChange}>
                    {PRIORITY_OPTIONS.map((p) => (
                        <DropdownMenuRadioItem key={p.value} value={p.value}>
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.badge}`}>
                                {t(p.labelKey)}
                            </span>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
