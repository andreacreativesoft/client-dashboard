"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateTicketAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";

interface TicketAssignControlProps {
    ticketId: string;
    currentAssignedTo: string | null;
    adminUsers: { id: string; full_name: string }[];
}

const NONE = "none";

export function TicketAssignControl({
    ticketId,
    currentAssignedTo,
    adminUsers,
}: TicketAssignControlProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const [pending, startTransition] = useTransition();
    const [value, setValue] = useState(currentAssignedTo ?? NONE);

    function handleChange(next: string) {
        const prev = value;
        setValue(next);
        startTransition(async () => {
            const result = await updateTicketAction(ticketId, {
                assigned_to: next === NONE ? null : next,
            });
            if (result.success) {
                router.refresh();
            } else {
                setValue(prev);
                toast.error(result.error || "Échec de l'assignation");
            }
        });
    }

    return (
        <Select value={value} onValueChange={handleChange} disabled={pending}>
            <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder={t("tickets.unassigned")} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>{t("tickets.unassigned")}</SelectItem>
                {adminUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
