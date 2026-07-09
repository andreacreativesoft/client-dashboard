import type { Metadata } from "next";

import { GBPAnalytics } from "@/components/analytics/gbp-analytics";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Votre fiche Google",
};

export default async function BusinessProfilePage() {
    await requireClientView();

    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    return (
        <PageContainer>
            <PageTitle className="mb-6">{t(lang, "gbp.title")}</PageTitle>

            <GBPAnalytics />
        </PageContainer>
    );
}
