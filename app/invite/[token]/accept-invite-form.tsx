"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction } from "@/lib/actions/invites";

interface AcceptInviteFormProps {
  token: string;
  email: string;
  needsProfileInfo: boolean;
}

export function AcceptInviteForm({ token, email, needsProfileInfo }: AcceptInviteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    // Get optional profile fields
    const full_name = needsProfileInfo
      ? (form.elements.namedItem("full_name") as HTMLInputElement)?.value
      : undefined;
    const phone = needsProfileInfo
      ? (form.elements.namedItem("phone") as HTMLInputElement)?.value || undefined
      : undefined;

    if (needsProfileInfo && !full_name) {
      setError("Full name is required");
      setLoading(false);
      return;
    }

    const result = await acceptInviteAction(token, {
      password,
      full_name,
      phone,
    });

    if (!result.success) {
      setError(result.error || "Something went wrong");
      setLoading(false);
      return;
    }

    // Redirect to login with success message
    router.push("/login?message=Account created successfully. Please sign in.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {needsProfileInfo && (
        <>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-medium">{email}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Create Password</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          placeholder="Min 8 characters"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm Password</Label>
        <PasswordInput
          id="confirm_password"
          name="confirm_password"
          required
          minLength={8}
          placeholder="Confirm your password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating Account..." : "Create Account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our terms of service.
      </p>
    </form>
  );
}
