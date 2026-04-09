import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]">
          Mot de passe oublié
        </h1>
        <p className="mt-2 text-[16px] leading-[1.5] text-[#6D6A65]">
          Entrez votre e-mail pour recevoir un lien de réinitialisation
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
