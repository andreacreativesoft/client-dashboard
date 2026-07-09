import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageContainer, PageTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { t } from "@/lib/i18n/translations";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
    title: "Réglages",
};

export default async function SettingsPage() {
    const profile = await getProfile();

    if (!profile) {
        redirect("/login");
    }

    const lang = profile.language || "fr-BE";

    return (
        <PageContainer>
            <PageTitle className="mb-6">{t(lang, "settings.title")}</PageTitle>
            <div className="max-w-2xl">
                <SettingsForm profile={profile} />
            </div>
        </PageContainer>
    );
}
