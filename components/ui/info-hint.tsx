"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
    /** Texte d'explication (déjà traduit) affiché dans la bulle. */
    text: string;
    className?: string;
    /** Libellé accessible du bouton — défaut : "Plus d'informations". */
    label?: string;
};

/**
 * Petit "i" d'information avec bulle explicative au survol / focus.
 * Sert à traduire un terme ou expliquer d'où vient une valeur, sans alourdir
 * l'interface client. Le trigger est un vrai bouton → accessible au clavier et
 * s'ouvre aussi au focus tactile.
 */
export function InfoHint({ text, className, label }: Props) {
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={label ?? text}
                        onClick={(e) => e.preventDefault()}
                        className={cn(
                            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-ink-muted/60 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
                            className,
                        )}>
                        <Info className="size-3.5" aria-hidden="true" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-center leading-snug">
                    {text}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
