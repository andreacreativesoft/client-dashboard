import type { Metadata } from "next";

import { GSCAnalytics } from "@/components/analytics/gsc-analytics";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Votre visibilité sur Google",
};

export default async function SearchConsolePage() {
    await requireClientView();

    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    return (
        <PageContainer>
            <PageTitle className="mb-6">{t(lang, "gsc.title")}</PageTitle>

            <GSCAnalytics />
        </PageContainer>
    );
}
