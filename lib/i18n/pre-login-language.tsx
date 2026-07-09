"use client";

import { Globe } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

import { SUPPORTED_LANGUAGES } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import type { AppLanguage } from "@/types/database";

import { LanguageProvider, useLanguage } from "./language-context";

const STORAGE_KEY = "vsp:language";
const DEFAULT_LANGUAGE: AppLanguage = "fr-BE";
const VALID_LANGUAGES = new Set<AppLanguage>(["en", "fr-BE", "ro"]);

/** Maps a browser language tag (e.g. "fr-FR", "en-US", "ro") to a supported app language. */
function detectBrowserLanguage(): AppLanguage {
    if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
    for (const tag of navigator.languages ?? [navigator.language]) {
        const lower = tag.toLowerCase();
        if (lower.startsWith("fr")) return "fr-BE";
        if (lower.startsWith("ro")) return "ro";
        if (lower.startsWith("en")) return "en";
    }
    return DEFAULT_LANGUAGE;
}

interface PreLoginLanguageContextValue {
    language: AppLanguage;
    setLanguage: (language: AppLanguage) => void;
}

const PreLoginLanguageContext = createContext<PreLoginLanguageContextValue>({
    language: DEFAULT_LANGUAGE,
    setLanguage: () => {},
});

/**
 * Language provider for pages served before authentication (login, forgot
 * password, invite). Resolution order: stored choice (localStorage) → browser
 * language → French. The chosen language is persisted so it sticks across the
 * pre-login flow. Once logged in, `profiles.language` takes over (dashboard).
 */
export function PreLoginLanguageProvider({ children }: { children: React.ReactNode }) {
    // Start on the default so SSR and the first client render agree, then
    // restore the stored/browser language after hydration.
    const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_LANGUAGES.has(stored as AppLanguage)) {
            setLanguageState(stored as AppLanguage);
        } else {
            setLanguageState(detectBrowserLanguage());
        }
    }, []);

    function setLanguage(next: AppLanguage) {
        setLanguageState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Ignore storage failures (private mode, quota) — the choice still
            // applies for the current session.
        }
    }

    return (
        <PreLoginLanguageContext.Provider value={{ language, setLanguage }}>
            <LanguageProvider language={language}>{children}</LanguageProvider>
        </PreLoginLanguageContext.Provider>
    );
}

/** Discreet globe + native select to switch language on pre-login pages. */
export function LanguageSwitcher({ className }: { className?: string }) {
    const { language, setLanguage } = useContext(PreLoginLanguageContext);
    const { t } = useLanguage();

    return (
        <label
            className={cn("relative inline-flex items-center gap-1.5 text-ink-muted", className)}>
            <Globe className="size-4" aria-hidden />
            <span className="sr-only">{t("language.label")}</span>
            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                className="cursor-pointer appearance-none rounded-md bg-transparent py-1 pr-1 text-[13px] leading-[1.5] text-ink-muted outline-none transition-colors hover:text-ink focus:text-ink">
                {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                        {lang.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
