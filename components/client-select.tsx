"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Client {
    id: string;
    business_name: string;
}

interface ClientSelectProps {
    clients: Client[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    /** When set, prepends an "all clients" option using the "all" sentinel value. */
    allLabel?: string;
    triggerClassName?: string;
}

/**
 * Reusable client picker: a shadcn Select listing every client alphabetically.
 * Used by the "open a client space" dialog and the admin tickets client filter.
 */
export function ClientSelect({
    clients,
    value,
    onValueChange,
    placeholder = "Sélectionner un client…",
    allLabel,
    triggerClassName = "w-full",
}: ClientSelectProps) {
    const sorted = [...clients].sort((a, b) =>
        a.business_name.localeCompare(b.business_name, undefined, { sensitivity: "base" }),
    );

    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
                {sorted.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                        {client.business_name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
