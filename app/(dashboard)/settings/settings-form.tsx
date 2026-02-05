"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import {
  updateProfileAction,
  changePasswordAction,
  type ProfileFormData,
} from "@/lib/actions/profile";
import { AvatarUpload } from "./avatar-upload";
import type { Profile } from "@/types/database";

interface SettingsFormProps {
  profile: Profile;
}

export function SettingsForm({ profile }: SettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData: ProfileFormData = {
      full_name: (form.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
    };

    const result = await updateProfileAction(formData);
    setLoading(false);

    if (result.success) {
      setMessage({ type: "success", text: "Profile updated successfully" });
    } else {
      setMessage({ type: "error", text: result.error || "Failed to update profile" });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("new_password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;

    if (newPassword !== confirmPassword) {
      setPasswordLoading(false);
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordLoading(false);
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    const result = await changePasswordAction("", newPassword);
    setPasswordLoading(false);

    if (result.success) {
      setPasswordMessage({ type: "success", text: "Password changed successfully" });
      form.reset();
    } else {
      setPasswordMessage({ type: "error", text: result.error || "Failed to change password" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label className="mb-3 block">Profile Photo</Label>
            <AvatarUpload
              currentAvatarUrl={profile.avatar_url}
              userName={profile.full_name}
              userId={profile.id}
            />
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone || ""}
                placeholder="+1 (555) 123-4567"
              />
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                minLength={8}
                required
                placeholder="Min 8 characters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                minLength={8}
                required
                placeholder="Confirm new password"
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
              {passwordLoading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PushNotificationToggle />
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm font-medium capitalize">{profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm font-medium">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
