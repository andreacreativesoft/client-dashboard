"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import {
  updateProfileAction,
  changePasswordAction,
  type ProfileFormData,
} from "@/lib/actions/profile";
import { AvatarUpload } from "./avatar-upload";
import { useLanguage } from "@/lib/i18n/language-context";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/translations";
import type { Profile } from "@/types/database";
import type { AppLanguage } from "@/types/database";

interface SettingsFormProps {
  profile: Profile;
}

export function SettingsForm({ profile }: SettingsFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(profile.language || "en");

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData: ProfileFormData = {
      full_name: (form.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      language: selectedLanguage,
    };

    const result = await updateProfileAction(formData);
    setLoading(false);

    if (result.success) {
      setMessage({ type: "success", text: t("settings.profile_updated") });
    } else {
      setMessage({ type: "error", text: result.error || t("settings.profile_update_failed") });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    const form = e.currentTarget;
    const currentPassword = (form.elements.namedItem("current_password") as HTMLInputElement).value;
    const newPassword = (form.elements.namedItem("new_password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;

    if (newPassword !== confirmPassword) {
      setPasswordLoading(false);
      setPasswordMessage({ type: "error", text: t("settings.passwords_no_match") });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordLoading(false);
      setPasswordMessage({ type: "error", text: t("settings.password_min_length") });
      return;
    }

    const result = await changePasswordAction(currentPassword, newPassword);
    setPasswordLoading(false);

    if (result.success) {
      setPasswordMessage({ type: "success", text: t("settings.password_changed") });
      form.reset();
    } else {
      setPasswordMessage({ type: "error", text: result.error || t("settings.password_change_failed") });
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

          <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                name="full_name"
                defaultValue={profile.full_name}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("settings.phone")}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone || ""}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{t("language.label")}</Label>
              <select
                id="language"
                name="language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as AppLanguage)}
                className="flex h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <p
                className={`text-sm ${
                  message.type === "success" ? "text-success" : "text-destructive"
                }`}
              >
                {message.text}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? t("settings.saving") : t("settings.save_changes")}
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
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">{t("settings.current_password")}</Label>
              <PasswordInput
                id="current_password"
                name="current_password"
                required
                placeholder={t("settings.current_password_placeholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">{t("settings.new_password")}</Label>
              <PasswordInput
                id="new_password"
                name="new_password"
                minLength={8}
                required
                placeholder={t("settings.min_8_chars")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">{t("settings.confirm_password")}</Label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                minLength={8}
                required
                placeholder={t("settings.confirm_new_password")}
              />
            </div>

            {passwordMessage && (
              <p
                className={`text-sm ${
                  passwordMessage.type === "success" ? "text-success" : "text-destructive"
                }`}
              >
                {passwordMessage.text}
              </p>
            )}

            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? t("settings.changing") : t("settings.change_password")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PushNotificationToggle />
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.role")}</span>
            <span className="text-sm font-medium capitalize">{profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.member_since")}</span>
            <span className="text-sm font-medium">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
