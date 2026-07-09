import type { Metadata } from "next";

import { GA4Analytics } from "@/components/analytics/ga4-analytics";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Analyse de votre site",
};

export default async function AnalyticsPage() {
    await requireClientView();

    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    return (
        <PageContainer>
            <PageTitle className="mb-6">{t(lang, "analytics.title")}</PageTitle>

            <GA4Analytics />
        </PageContainer>
    );
}
