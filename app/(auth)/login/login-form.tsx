"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecaptcha } from "@/components/recaptcha-provider";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const { executeRecaptcha } = useRecaptcha();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (blocked) return;

    setError(null);
    setLoading(true);

    try {
      // Execute reCAPTCHA (returns undefined if not configured)
      const recaptchaToken = await executeRecaptcha("login");

      // Call server action
      const result = await loginAction(email, password, recaptchaToken);

      if (!result.success) {
        setError(result.error || "Invalid email or password");
        if (result.blocked) {
          setBlocked(true);
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className={`rounded-lg p-3 text-sm ${
          blocked
            ? "border border-destructive/30 bg-destructive/10 text-destructive"
            : "bg-destructive/10 text-destructive"
        }`}>
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
          disabled={loading || blocked}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading || blocked}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || blocked}>
        {loading ? "Signing in..." : blocked ? "Account blocked" : "Sign in"}
      </Button>
    </form>
  );
}
