"use client";

import { Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
    count: number;
    countLabel: string;
    search: string;
    onSearchChange: (v: string) => void;
    searchPlaceholder?: string;
    filters?: ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
};

export function ListToolbar({
    count,
    countLabel,
    search,
    onSearchChange,
    searchPlaceholder = "Rechercher…",
    filters,
    actionLabel,
    onAction,
    className,
}: Props) {
    return (
        <div className={cn("mb-6 flex flex-col gap-3", className)}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{count}</span> {countLabel}
                </p>
                {actionLabel && onAction && (
                    <Button onClick={onAction}>
                        <Plus className="mr-2 size-4" />
                        {actionLabel}
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-9"
                    />
                </div>
                {filters && <div className="flex flex-wrap gap-2">{filters}</div>}
            </div>
        </div>
    );
}

export function FilterSelect({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-11">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
