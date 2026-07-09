"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction } from "@/lib/actions/invites";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
    acceptInviteOnlyPasswordSchema,
    acceptInviteWithProfileSchema,
    type AcceptInviteOnlyPasswordInput,
    type AcceptInviteWithProfileInput,
} from "@/lib/schemas/invites";

interface AcceptInviteFormProps {
    token: string;
    email: string;
    needsProfileInfo: boolean;
}

const errorClass = "text-xs text-destructive";

export function AcceptInviteForm({ token, email, needsProfileInfo }: AcceptInviteFormProps) {
    return needsProfileInfo ? (
        <AcceptInviteFormWithProfile token={token} email={email} />
    ) : (
        <AcceptInviteFormPasswordOnly token={token} />
    );
}

function AcceptInviteFormWithProfile({ token, email }: { token: string; email: string }) {
    const router = useRouter();
    const { t } = useLanguage();
    const [serverError, setServerError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AcceptInviteWithProfileInput>({
        resolver: zodResolver(acceptInviteWithProfileSchema),
        mode: "onBlur",
        defaultValues: { full_name: "", phone: "", password: "", confirm_password: "" },
    });

    async function onSubmit(values: AcceptInviteWithProfileInput) {
        setServerError(null);
        const result = await acceptInviteAction(token, {
            password: values.password,
            full_name: values.full_name,
            phone: values.phone || undefined,
        });
        if (!result.success) {
            setServerError(result.error || t("login.error_generic"));
            return;
        }
        router.push("/login");
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
                <span className="text-muted-foreground">{t("invite.email_label")}:</span>{" "}
                <span className="font-medium">{email}</span>
            </div>

            <div className="space-y-2">
                <Label htmlFor="full_name">{t("invite.full_name")} *</Label>
                <Input
                    id="full_name"
                    placeholder={t("invite.full_name_placeholder")}
                    aria-invalid={!!errors.full_name}
                    {...register("full_name")}
                />
                {errors.full_name && (
                    <p className={errorClass}>{t(errors.full_name.message as TranslationKey)}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">{t("invite.phone")}</Label>
                <Input
                    id="phone"
                    type="tel"
                    placeholder={t("invite.phone_placeholder")}
                    aria-invalid={!!errors.phone}
                    {...register("phone")}
                />
                {errors.phone && (
                    <p className={errorClass}>{t(errors.phone.message as TranslationKey)}</p>
                )}
            </div>

            <PasswordFields
                register={register}
                errors={errors as Record<string, { message?: string } | undefined>}
            />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? t("invite.creating") : t("invite.create_account")}
            </Button>

            <p className="text-center text-xs text-muted-foreground">{t("invite.terms")}</p>
        </form>
    );
}

function AcceptInviteFormPasswordOnly({ token }: { token: string }) {
    const router = useRouter();
    const { t } = useLanguage();
    const [serverError, setServerError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AcceptInviteOnlyPasswordInput>({
        resolver: zodResolver(acceptInviteOnlyPasswordSchema),
        mode: "onBlur",
        defaultValues: { password: "", confirm_password: "" },
    });

    async function onSubmit(values: AcceptInviteOnlyPasswordInput) {
        setServerError(null);
        const result = await acceptInviteAction(token, { password: values.password });
        if (!result.success) {
            setServerError(result.error || t("login.error_generic"));
            return;
        }
        router.push("/login");
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <PasswordFields
                register={register}
                errors={errors as Record<string, { message?: string } | undefined>}
            />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? t("invite.creating") : t("invite.create_account")}
            </Button>

            <p className="text-center text-xs text-muted-foreground">{t("invite.terms")}</p>
        </form>
    );
}

function PasswordFields({
    register,
    errors,
}: {
    register: (name: "password" | "confirm_password") => Record<string, unknown>;
    errors: Record<string, { message?: string } | undefined>;
}) {
    const { t } = useLanguage();

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="password">{t("invite.create_password")}</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder={t("invite.password_placeholder")}
                    aria-invalid={!!errors.password}
                    {...register("password")}
                />
                {errors.password && (
                    <p className={errorClass}>{t(errors.password.message as TranslationKey)}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirm_password">{t("invite.confirm_password")}</Label>
                <Input
                    id="confirm_password"
                    type="password"
                    placeholder={t("invite.confirm_password_placeholder")}
                    aria-invalid={!!errors.confirm_password}
                    {...register("confirm_password")}
                />
                {errors.confirm_password && (
                    <p className={errorClass}>
                        {t(errors.confirm_password.message as TranslationKey)}
                    </p>
                )}
            </div>
        </>
    );
}
