"use client";

import { PageTitle } from "@/components/ui/page";
import { useLanguage } from "@/lib/i18n/language-context";
import { LanguageSwitcher, PreLoginLanguageProvider } from "@/lib/i18n/pre-login-language";

import { LoginForm } from "./login-form";

function LoginContent() {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col gap-5">
            <div className="flex justify-end">
                <LanguageSwitcher />
            </div>

            <div>
                <PageTitle>{t("login.welcome")}</PageTitle>
                <p className="mt-2 text-[16px] leading-[1.5] text-ink-muted">
                    {t("login.subtitle")}
                </p>
            </div>

            <LoginForm />

            <p className="text-center text-[14px] text-ink">
                {t("login.need_help")}
                <a href="mailto:support@votresitepro.com" className="text-orange hover:underline">
                    {t("login.contact_team")}
                </a>
            </p>
        </div>
    );
}

export function LoginClient() {
    return (
        <PreLoginLanguageProvider>
            <LoginContent />
        </PreLoginLanguageProvider>
    );
}
