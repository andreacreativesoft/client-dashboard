"use client";

import { createContext, useContext } from "react";

import type { AppLanguage } from "@/types/database";

import { t as translate, type TranslationKey } from "./translations";

interface LanguageContextValue {
    language: AppLanguage;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
    language: "fr-BE",
    t: (key) => translate("fr-BE", key),
});

export function LanguageProvider({
    language,
    children,
}: {
    language: AppLanguage;
    children: React.ReactNode;
}) {
    const value: LanguageContextValue = {
        language,
        t: (key: TranslationKey) => translate(language, key),
    };

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    return useContext(LanguageContext);
}
