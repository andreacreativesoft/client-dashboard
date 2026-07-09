"use client";

import { ChevronDown } from "lucide-react";

import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

import { useSelectedWebsite } from "./selected-website-context";

/**
 * Sélecteur de site global. `sidebar` = dans la sidebar (fond de marque),
 * `bar` = barre fine en haut sur mobile. Rien si le client n'a aucun site ;
 * désactivé s'il n'en a qu'un (une seule dimension → rien à switcher).
 */
export function SiteSwitcher({ variant }: { variant: "sidebar" | "bar" }) {
    const { websites, selectedWebsiteId, setSelectedWebsiteId } = useSelectedWebsite();
    const { t } = useLanguage();

    if (websites.length === 0) return null;
    const disabled = websites.length <= 1;

    const select = (
        <div className="relative w-full">
            <select
                value={selectedWebsiteId ?? ""}
                onChange={(e) => setSelectedWebsiteId(e.target.value)}
                disabled={disabled}
                aria-label={t("switcher.label")}
                className={cn(
                    "w-full cursor-pointer appearance-none rounded-lg px-3 py-2 pr-9 text-sm font-medium outline-none transition-colors disabled:cursor-default disabled:opacity-70",
                    variant === "sidebar"
                        ? "border-0 bg-brand-dark/30 text-white/90 hover:bg-brand-dark/60 focus-visible:ring-2 focus-visible:ring-white/30"
                        : "border border-input bg-background text-ink focus-visible:ring-2 focus-visible:ring-brand",
                )}>
                {websites.map((w) => (
                    <option key={w.id} value={w.id} className="text-ink">
                        {w.name}
                    </option>
                ))}
            </select>
            <ChevronDown
                className={cn(
                    "pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2",
                    variant === "sidebar" ? "text-white/60" : "text-ink-muted",
                )}
            />
        </div>
    );

    if (variant === "bar") {
        return (
            <div className="sticky top-0 z-30 border-b border-line bg-page/95 px-4 py-2 backdrop-blur md:hidden">
                {select}
            </div>
        );
    }

    return <div className="pb-1">{select}</div>;
}
