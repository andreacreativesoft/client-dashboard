import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
    children: ReactNode;
    className?: string;
};

export function PageContainer({ children, className }: Props) {
    return <div className={cn("px-8 pb-12 pt-4", className)}>{children}</div>;
}

const MPLUS1_STYLE = { fontFamily: "var(--font-mplus1), sans-serif" };

export function PageTitle({ children, className }: Props) {
    return (
        <h1
            className={cn(
                "text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-ink",
                className,
            )}
            style={MPLUS1_STYLE}>
            {children}
        </h1>
    );
}

export function PageSubtitle({ children, className }: Props) {
    return <p className={cn("text-[18px] leading-[1.5] text-ink-muted", className)}>{children}</p>;
}

/** Section heading inside a page (below the page title, above a block of content). */
export function SectionTitle({ children, className }: Props) {
    return (
        <h2
            className={cn(
                "text-[20px] font-extrabold uppercase leading-[1.3] tracking-[-0.5px] text-ink",
                className,
            )}
            style={MPLUS1_STYLE}>
            {children}
        </h2>
    );
}
