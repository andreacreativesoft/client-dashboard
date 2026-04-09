import type { Metadata } from "next";
import { getAdminSettings } from "@/lib/actions/admin-settings";
import { AISettingsDashboard } from "./ai-settings-dashboard";

export const metadata: Metadata = {
  title: "AI Settings",
};

export default async function AISettingsPage() {
  const settings = await getAdminSettings();

  return (
    <div className="px-8 py-12">
      <div className="mb-6">
        <h1 className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>AI Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the WordPress AI assistant, manage tools, and set API keys.
        </p>
      </div>

      <AISettingsDashboard initialSettings={settings} />
    </div>
  );
}
