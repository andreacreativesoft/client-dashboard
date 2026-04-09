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
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading || blocked}
            className="w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 pr-12 text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none transition-colors focus:border-[#2A5959] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-[#6D6A65] hover:text-[#2E2E2E]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        </div>
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
