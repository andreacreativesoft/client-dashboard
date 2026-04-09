import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profile";
import { t } from "@/lib/i18n/translations";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  const lang = profile.language || "en";

  return (
    <div className="px-8 py-12">
      <h1 className="mb-6 text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>{t(lang, "settings.title")}</h1>
      <div className="max-w-2xl">
        <SettingsForm profile={profile} />
      </div>
    </div>
  );
}
