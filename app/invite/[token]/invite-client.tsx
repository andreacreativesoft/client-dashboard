"use client";

import { AlertCircle } from "lucide-react";

import { useLanguage } from "@/lib/i18n/language-context";
import { LanguageSwitcher, PreLoginLanguageProvider } from "@/lib/i18n/pre-login-language";

import { AcceptInviteForm } from "./accept-invite-form";

interface InviteClientProps {
    invalid: boolean;
    errorMessage?: string | null;
    token: string;
    email: string;
    fullName?: string | null;
    needsProfileInfo: boolean;
}

function InviteContent({
    invalid,
    errorMessage,
    token,
    email,
    fullName,
    needsProfileInfo,
}: InviteClientProps) {
    const { t } = useLanguage();

    if (invalid) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
                <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
                    <div className="flex justify-end">
                        <LanguageSwitcher />
                    </div>
                    <div className="text-center">
                        <div className="mb-4 flex justify-center">
                            <AlertCircle className="h-12 w-12 text-destructive" />
                        </div>
                        <h1 className="mb-2 text-xl font-bold">{t("invite.invalid_title")}</h1>
                        <p className="text-sm text-muted-foreground">
                            {errorMessage || t("invite.invalid_desc")}
                        </p>
                        <a
                            href="/login"
                            className="mt-4 inline-block text-sm text-foreground underline hover:no-underline">
                            {t("invite.go_to_login")}
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
                <div className="flex justify-end">
                    <LanguageSwitcher />
                </div>

                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold">{t("invite.welcome")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {needsProfileInfo ? t("invite.complete_profile") : t("invite.set_password")}
                    </p>
                </div>

                {!needsProfileInfo && (
                    <div className="mb-6 rounded-lg bg-muted p-4">
                        <p className="text-sm">
                            <span className="text-muted-foreground">
                                {t("invite.email_label")}:
                            </span>{" "}
                            <span className="font-medium">{email}</span>
                        </p>
                        <p className="text-sm">
                            <span className="text-muted-foreground">{t("invite.name_label")}:</span>{" "}
                            <span className="font-medium">{fullName}</span>
                        </p>
                    </div>
                )}

                <AcceptInviteForm token={token} email={email} needsProfileInfo={needsProfileInfo} />
            </div>
        </div>
    );
}

export function InviteClient(props: InviteClientProps) {
    return (
        <PreLoginLanguageProvider>
            <InviteContent {...props} />
        </PreLoginLanguageProvider>
    );
}
