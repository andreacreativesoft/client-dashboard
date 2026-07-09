import type { Metadata } from "next";

import { ConnectedAccountsList } from "@/components/integrations/connected-accounts-list";
import { Button } from "@/components/ui/button";
import { PageContainer, PageSubtitle, PageTitle } from "@/components/ui/page";
import { getAllConnectedAccounts } from "@/lib/actions/connected-accounts";

export const metadata: Metadata = {
    title: "Comptes connectés",
};

export default async function AdminConnectionsPage() {
    const accounts = await getAllConnectedAccounts();
    const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    return (
        <PageContainer>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <PageTitle>Comptes connectés</PageTitle>
                    <PageSubtitle>
                        Tous les comptes Google de l&apos;app. Un compte <strong>global</strong> est
                        géré par l&apos;agence et liable à n&apos;importe quel site ; un compte{" "}
                        <strong>spécifique</strong> appartient à un client (créé ici ou par le
                        client lui-même) et ne se lie qu&apos;à ses propres sites.
                    </PageSubtitle>
                </div>
                {googleConfigured && (
                    <Button asChild>
                        <a href="/api/auth/google?scope=global">Connecter un compte global</a>
                    </Button>
                )}
            </div>

            {!googleConfigured && (
                <p className="mb-4 rounded border border-dashed border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    OAuth Google non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
                    TOKEN_ENCRYPTION_KEY).
                </p>
            )}

            <ConnectedAccountsList
                accounts={accounts}
                showOwner
                emptyLabel="Aucun compte connecté pour le moment."
            />
        </PageContainer>
    );
}
