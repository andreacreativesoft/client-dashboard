"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div
          className={`rounded-lg p-3 text-sm ${
            blocked
              ? "border border-red-300 bg-red-50 text-red-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {error}
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-2">
        <label
          className="text-[14px] leading-[1.5] text-[#111928]"
          htmlFor="email"
        >
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading || blocked}
          className="w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none transition-colors focus:border-[#2A5959] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <label
          className="text-[14px] leading-[1.5] text-[#111928]"
          htmlFor="password"
        >
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading || blocked}
          className="w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none transition-colors focus:border-[#2A5959] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Remember me & Forgot password */}
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 rounded border-[#B5C3BE] bg-[#F9FAFB] accent-[#2A5959]"
          />
          <span className="text-[14px] leading-[1.5] text-[#6B7280]">
            Remember me
          </span>
        </label>
        <Link
          href="/forgot-password"
          className="text-[14px] leading-[1.5] text-[#F2612E] hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || blocked}
        className="w-full cursor-pointer rounded-full bg-[#F2612E] px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-[#E0551F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Connexion..."
          : blocked
            ? "Compte bloqué"
            : "Se connecter"}
      </button>
    </form>
  );
}
