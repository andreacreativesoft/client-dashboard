import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>
          Bienvenue
        </h1>
        <p className="mt-2 text-[16px] leading-[1.5] text-[#6D6A65]">
          Connectez-vous à votre espace personnel
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-[14px] text-[#2E2E2E]">
        {"Besoin d'aide ? "}
        <a href="mailto:support@votresitepro.com" className="text-[#F2612E] hover:underline">
          Contactez notre équipe
        </a>
      </p>
    </div>
  );
}
