import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectedAccountsList } from "@/components/integrations/connected-accounts-list";
import { IntegrationsBoard } from "@/components/integrations/integrations-board";
import { Button } from "@/components/ui/button";
import { PageContainer, PageSubtitle, PageTitle, SectionTitle } from "@/components/ui/page";
import { getMyConnectedAccounts } from "@/lib/actions/connected-accounts";
import { getWebsitesForClient } from "@/lib/actions/websites";
import { getActiveClientId, requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Comptes connectés",
};

export default async function ClientConnectionsPage() {
    await requireClientView();
    const clientId = await getActiveClientId();
    if (!clientId) redirect("/dashboard");

    const [accounts, websites] = await Promise.all([
        getMyConnectedAccounts(),
        getWebsitesForClient(clientId),
    ]);
    const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    return (
        <PageContainer>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <PageTitle>Comptes connectés</PageTitle>
                    <PageSubtitle>
                        Paramètres avancés. Connectez votre compte Google pour relier vos
                        statistiques (Analytics, Business Profile, Search Console) à vos sites.
                    </PageSubtitle>
                </div>
                {googleConfigured && (
                    <Button asChild>
                        <a href="/api/auth/google">Connecter mon compte Google</a>
                    </Button>
                )}
            </div>

            {!googleConfigured && (
                <p className="mb-4 rounded border border-dashed border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    La connexion Google n&apos;est pas disponible pour le moment. Contactez votre
                    agence.
                </p>
            )}

            <ConnectedAccountsList
                accounts={accounts}
                showOwner={false}
                emptyLabel="Aucun compte connecté. Connectez-en un pour afficher vos statistiques."
            />

            {accounts.length > 0 && websites.length > 0 && (
                <div className="mt-8 space-y-4">
                    <SectionTitle>Liaison par site</SectionTitle>
                    <p className="-mt-2 text-sm text-muted-foreground">
                        Indiquez, pour chaque site, la propriété Analytics, la fiche Business
                        Profile et le site Search Console correspondants.
                    </p>
                    {websites.map((w) => (
                        <div key={w.id} className="rounded-lg border border-border p-4">
                            <p className="mb-2 text-sm font-medium">{w.name}</p>
                            <IntegrationsBoard
                                websiteId={w.id}
                                googleConfigured={googleConfigured}
                            />
                        </div>
                    ))}
                </div>
            )}
        </PageContainer>
    );
}
