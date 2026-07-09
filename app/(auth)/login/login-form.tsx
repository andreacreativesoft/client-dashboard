"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { useRecaptcha } from "@/components/recaptcha-provider";
import { loginAction } from "@/lib/actions/auth";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

const inputClass =
    "w-full rounded-lg border border-gray-300 bg-surface px-4 py-3 text-[14px] leading-[1.5] text-ink placeholder-ink-muted outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500";

const errorClass = "text-[12px] leading-[1.5] text-red-600";

export function LoginForm() {
    const router = useRouter();
    const { t } = useLanguage();
    const { executeRecaptcha } = useRecaptcha();
    const [serverError, setServerError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [blocked, setBlocked] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        mode: "onBlur",
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: LoginInput) {
        if (blocked) return;
        setServerError(null);
        try {
            const recaptchaToken = await executeRecaptcha("login");
            const result = await loginAction(values.email, values.password, recaptchaToken);

            if (!result.success) {
                setServerError(result.error || t("login.error_invalid"));
                if (result.blocked) setBlocked(true);
                return;
            }

            router.push("/dashboard");
            router.refresh();
        } catch {
            setServerError(t("login.error_generic"));
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {serverError && (
                <div
                    className={`rounded-lg p-3 text-sm ${
                        blocked
                            ? "border border-red-300 bg-red-50 text-red-600"
                            : "bg-red-50 text-red-600"
                    }`}>
                    {serverError}
                </div>
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
                    disabled={isSubmitting || blocked}
                    aria-invalid={!!errors.email}
                    {...register("email")}
                    className={inputClass}
                />
                {errors.email && (
                    <p className={errorClass}>{t(errors.email.message as TranslationKey)}</p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[14px] leading-[1.5] text-gray-900" htmlFor="password">
                    {t("login.password_label")}
                </label>
                <div className="relative">
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••"
                        autoComplete="current-password"
                        disabled={isSubmitting || blocked}
                        aria-invalid={!!errors.password}
                        {...register("password")}
                        className={`${inputClass} pr-12`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-ink-muted hover:text-ink"
                        aria-label={
                            showPassword ? t("login.hide_password") : t("login.show_password")
                        }>
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                </div>
                {errors.password && (
                    <p className={errorClass}>{t(errors.password.message as TranslationKey)}</p>
                )}
            </div>

            <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        className="size-4 rounded border-brand-border bg-surface accent-brand"
                    />
                    <span className="text-[14px] leading-[1.5] text-gray-500">
                        {t("login.remember_me")}
                    </span>
                </label>
                <Link
                    href="/forgot-password"
                    className="text-[14px] leading-[1.5] text-orange hover:underline">
                    {t("login.forgot_password")}
                </Link>
            </div>

            <button
                type="submit"
                disabled={isSubmitting || blocked}
                className="w-full cursor-pointer rounded-full bg-orange px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting
                    ? t("login.submitting")
                    : blocked
                      ? t("login.blocked")
                      : t("login.submit")}
            </button>
        </form>
    );
}
