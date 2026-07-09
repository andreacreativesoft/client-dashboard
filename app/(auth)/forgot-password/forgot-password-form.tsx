"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { useRecaptcha } from "@/components/recaptcha-provider";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas/auth";

const inputClass =
    "w-full rounded-lg border border-gray-300 bg-surface px-4 py-3 text-[14px] leading-[1.5] text-ink placeholder-ink-muted outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500";

const errorClass = "text-[12px] leading-[1.5] text-red-600";

export function ForgotPasswordForm() {
    const { t } = useLanguage();
    const { executeRecaptcha } = useRecaptcha();
    const [serverError, setServerError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordInput>({
        resolver: zodResolver(forgotPasswordSchema),
        mode: "onBlur",
        defaultValues: { email: "" },
    });

    async function onSubmit(values: ForgotPasswordInput) {
        setServerError(null);
        try {
            const recaptchaToken = await executeRecaptcha("forgot_password");
            const redirectUrl = `${window.location.origin}/auth/callback?next=/settings`;
            const result = await forgotPasswordAction(values.email, recaptchaToken, redirectUrl);

            if (!result.success) {
                setServerError(result.error || t("login.error_generic"));
                return;
            }

            setSuccess(true);
        } catch {
            setServerError(t("login.error_generic"));
        }
    }

    if (success) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
                    {t("fp.success")}
                </div>
                <p className="text-[13px] text-ink-muted">{t("fp.check_spam")}</p>
                <Link
                    href="/login"
                    className="inline-block text-[14px] text-orange hover:underline">
                    {t("fp.back_to_login")}
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {serverError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{serverError}</div>
            )}

            <div className="flex flex-col gap-2">
                <label className="text-[14px] leading-[1.5] text-gray-900" htmlFor="email">
                    {t("login.email_label")}
                </label>
                <input
                    id="email"
                    type="email"
                    placeholder={t("login.email_placeholder")}
                    autoComplete="email"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.email}
                    {...register("email")}
                    className={inputClass}
                />
                {errors.email && (
                    <p className={errorClass}>{t(errors.email.message as TranslationKey)}</p>
                )}
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full cursor-pointer rounded-full bg-orange px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? t("fp.submitting") : t("fp.submit")}
            </button>

            <p className="text-center">
                <Link href="/login" className="text-[14px] text-orange hover:underline">
                    {t("fp.back_to_login")}
                </Link>
            </p>
        </form>
    );
}
