"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateProfileAction, changePasswordAction } from "@/lib/actions/profile";
import { useLanguage } from "@/lib/i18n/language-context";
import { SUPPORTED_LANGUAGES, type TranslationKey } from "@/lib/i18n/translations";
import {
    profileUpdateSchema,
    type ProfileUpdateInput,
    changePasswordSchema,
    type ChangePasswordInput,
} from "@/lib/schemas/profile";
import type { Profile } from "@/types/database";

import { AvatarUpload } from "./avatar-upload";

interface SettingsFormProps {
    profile: Profile;
}

const errorClass = "text-xs text-destructive";

export function SettingsForm({ profile }: SettingsFormProps) {
    const { t } = useLanguage();

    const profileForm = useForm<ProfileUpdateInput>({
        resolver: zodResolver(profileUpdateSchema),
        mode: "onBlur",
        defaultValues: {
            full_name: profile.full_name || "",
            phone: profile.phone || "",
            language: profile.language || "fr-BE",
        },
    });

    const passwordForm = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordSchema),
        mode: "onBlur",
        defaultValues: {
            current_password: "",
            new_password: "",
            confirm_password: "",
        },
    });

    async function onProfileSubmit(values: ProfileUpdateInput) {
        const result = await updateProfileAction({
            full_name: values.full_name,
            phone: values.phone || "",
            language: values.language,
        });

        if (result.success) {
            toast.success(t("settings.profile_updated"));
        } else {
            toast.error(result.error || t("settings.profile_update_failed"));
        }
    }

    async function onPasswordSubmit(values: ChangePasswordInput) {
        const result = await changePasswordAction(values.current_password, values.new_password);

        if (result.success) {
            toast.success(t("settings.password_changed"));
            passwordForm.reset();
        } else {
            toast.error(result.error || t("settings.password_change_failed"));
        }
    }

    return (
        <div className="space-y-6">
            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("settings.profile")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-6">
                        <Label className="mb-3 block">{t("settings.profile_photo")}</Label>
                        <AvatarUpload
                            currentAvatarUrl={profile.avatar_url}
                            userName={profile.full_name}
                            userId={profile.id}
                        />
                    </div>

                    <form
                        onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                        className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">{t("settings.email")}</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profile.email}
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("settings.email_no_change")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="full_name">{t("settings.full_name")}</Label>
                            <Input
                                id="full_name"
                                placeholder="John Doe"
                                aria-invalid={!!profileForm.formState.errors.full_name}
                                {...profileForm.register("full_name")}
                            />
                            {profileForm.formState.errors.full_name && (
                                <p className={errorClass}>
                                    {t(
                                        profileForm.formState.errors.full_name
                                            .message as TranslationKey,
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">{t("settings.phone")}</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+32 470 12 34 56"
                                aria-invalid={!!profileForm.formState.errors.phone}
                                {...profileForm.register("phone")}
                            />
                            {profileForm.formState.errors.phone && (
                                <p className={errorClass}>
                                    {t(
                                        profileForm.formState.errors.phone
                                            .message as TranslationKey,
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="language">{t("language.label")}</Label>
                            <Controller
                                control={profileForm.control}
                                name="language"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="language" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_LANGUAGES.map((lang) => (
                                                <SelectItem key={lang.value} value={lang.value}>
                                                    {lang.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                            {profileForm.formState.isSubmitting
                                ? t("settings.saving")
                                : t("settings.save_changes")}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("settings.change_password")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                        className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current_password">
                                {t("settings.current_password")}
                            </Label>
                            <Input
                                id="current_password"
                                type="password"
                                placeholder={t("settings.current_password_placeholder")}
                                aria-invalid={!!passwordForm.formState.errors.current_password}
                                {...passwordForm.register("current_password")}
                            />
                            {passwordForm.formState.errors.current_password && (
                                <p className={errorClass}>
                                    {t(
                                        passwordForm.formState.errors.current_password
                                            .message as TranslationKey,
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new_password">{t("settings.new_password")}</Label>
                            <Input
                                id="new_password"
                                type="password"
                                placeholder={t("settings.min_8_chars")}
                                aria-invalid={!!passwordForm.formState.errors.new_password}
                                {...passwordForm.register("new_password")}
                            />
                            {passwordForm.formState.errors.new_password && (
                                <p className={errorClass}>
                                    {t(
                                        passwordForm.formState.errors.new_password
                                            .message as TranslationKey,
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm_password">
                                {t("settings.confirm_password")}
                            </Label>
                            <Input
                                id="confirm_password"
                                type="password"
                                placeholder={t("settings.confirm_new_password")}
                                aria-invalid={!!passwordForm.formState.errors.confirm_password}
                                {...passwordForm.register("confirm_password")}
                            />
                            {passwordForm.formState.errors.confirm_password && (
                                <p className={errorClass}>
                                    {t(
                                        passwordForm.formState.errors.confirm_password
                                            .message as TranslationKey,
                                    )}
                                </p>
                            )}
                        </div>

                        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                            {passwordForm.formState.isSubmitting
                                ? t("settings.changing")
                                : t("settings.change_password")}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("settings.account")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t("settings.role")}</span>
                        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                            {profile.role}
                        </Badge>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t("settings.member_since")}
                        </span>
                        <span className="text-sm font-medium">
                            {new Date(profile.created_at).toLocaleDateString(profile.language, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
