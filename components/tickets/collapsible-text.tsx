"use client";

import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

/**
 * Long text clamped to 5 lines with an expand/collapse toggle. The toggle only
 * appears when the content actually overflows the clamped height.
 */
export function CollapsibleText({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const ref = useRef<HTMLParagraphElement>(null);
    const { t } = useLanguage();

    // Measure once in the clamped state to decide whether a toggle is needed.
    useEffect(() => {
        const el = ref.current;
        if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
    }, [text]);

    return (
        <div>
            <p ref={ref} className={cn("whitespace-pre-wrap text-sm", !expanded && "line-clamp-5")}>
                {text}
            </p>
            {overflows && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 cursor-pointer text-sm font-medium text-brand hover:underline">
                    {expanded ? t("tickets.show_less") : t("tickets.show_more")}
                </button>
            )}
        </div>
    );
}
