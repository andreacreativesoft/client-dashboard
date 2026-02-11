"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecaptcha } from "@/components/recaptcha-provider";
import { forgotPasswordAction } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const { executeRecaptcha } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Execute reCAPTCHA (returns undefined if not configured)
      const recaptchaToken = await executeRecaptcha("forgot_password");

      const redirectUrl = `${window.location.origin}/auth/callback?next=/settings`;
      const result = await forgotPasswordAction(email, recaptchaToken, redirectUrl);

      if (!result.success) {
        setError(result.error || "Something went wrong");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
          Check your email for a password reset link.
        </div>
        <p className="text-xs text-muted-foreground">
          Don&apos;t see it? Check your spam or junk folder.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </Button>

      <p className="text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </p>
    </form>
  );
}
