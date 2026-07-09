"use client";

import { PageTitle } from "@/components/ui/page";
import { useLanguage } from "@/lib/i18n/language-context";
import { LanguageSwitcher, PreLoginLanguageProvider } from "@/lib/i18n/pre-login-language";

import { ForgotPasswordForm } from "./forgot-password-form";

function ForgotPasswordContent() {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col gap-5">
            <div className="flex justify-end">
                <LanguageSwitcher />
            </div>

            <div>
                <PageTitle>{t("fp.title")}</PageTitle>
                <p className="mt-2 text-[16px] leading-[1.5] text-ink-muted">{t("fp.subtitle")}</p>
            </div>

            <ForgotPasswordForm />
        </div>
    );
}

export function ForgotPasswordClient() {
    return (
        <PreLoginLanguageProvider>
            <ForgotPasswordContent />
        </PreLoginLanguageProvider>
    );
}
