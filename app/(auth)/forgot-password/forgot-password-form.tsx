"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
          Vérifiez votre e-mail pour un lien de réinitialisation.
        </div>
        <p className="text-[13px] text-[#6D6A65]">
          Vous ne le voyez pas ? Vérifiez votre dossier spam.
        </p>
        <Link
          href="/login"
          className="inline-block text-[14px] text-[#F2612E] hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

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
          disabled={loading}
          className="w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none transition-colors focus:border-[#2A5959] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-full bg-[#F2612E] px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-[#E0551F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Envoi..." : "Envoyer le lien"}
      </button>

      <p className="text-center">
        <Link
          href="/login"
          className="text-[14px] text-[#F2612E] hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
