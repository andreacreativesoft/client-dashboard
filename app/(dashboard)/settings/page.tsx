import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profile";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <div className="max-w-2xl">
        <SettingsForm profile={profile} />
      </div>
    </div>
  );
}
