"use client";

import { cn } from "@/lib/utils";

type Props = {
    page: number;
    perPage: number;
    total: number;
    onPageChange: (page: number) => void;
    className?: string;
};

export function Pagination({ page, perPage, total, onPageChange, className }: Props) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return null;

    const from = (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);

    const windowSize = Math.min(totalPages, 5);
    const pageNumbers = Array.from({ length: windowSize }, (_, i) => {
        if (totalPages <= 5) return i + 1;
        if (page <= 3) return i + 1;
        if (page >= totalPages - 2) return totalPages - 4 + i;
        return page - 2 + i;
    });

    return (
        <div className={cn("flex items-center justify-between p-4", className)}>
            <p className="text-[14px] text-ink-muted">
                Affiche{" "}
                <span className="font-bold text-ink">
                    {from}-{to}
                </span>{" "}
                sur <span className="font-bold text-ink">{total}</span>
            </p>
            <div className="flex overflow-hidden rounded border border-line">
                <NavBtn disabled={page <= 1} onClick={() => onPageChange(1)} label="«" />
                <NavBtn
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    label="‹"
                    bordered
                />
                {pageNumbers.map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onPageChange(n)}
                        className={cn(
                            "flex h-8 items-center justify-center border-l border-line px-3 text-[14px]",
                            n === page
                                ? "bg-orange text-white"
                                : "bg-white text-ink-muted hover:bg-surface",
                        )}>
                        {n}
                    </button>
                ))}
                <NavBtn
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    label="›"
                    bordered
                />
                <NavBtn
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(totalPages)}
                    label="»"
                    bordered
                />
            </div>
        </div>
    );
}

function NavBtn({
    disabled,
    onClick,
    label,
    bordered,
}: {
    disabled: boolean;
    onClick: () => void;
    label: string;
    bordered?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex h-8 items-center justify-center bg-white px-3 text-ink-muted hover:bg-surface disabled:opacity-30",
                bordered && "border-l border-line",
            )}>
            {label}
        </button>
    );
}
