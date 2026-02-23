import type { Metadata } from "next";
import { getAdminSettings } from "@/lib/actions/admin-settings";
import { AISettingsDashboard } from "./ai-settings-dashboard";

export const metadata: Metadata = {
  title: "AI Settings",
};

export default async function AISettingsPage() {
  const settings = await getAdminSettings();

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the WordPress AI assistant, manage tools, and set API keys.
        </p>
      </div>

      <AISettingsDashboard initialSettings={settings} />
    </div>
  );
}
