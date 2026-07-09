import type { Metadata } from "next";

import { PageContainer } from "@/components/ui/page";
import { getClientsWithWebsites } from "@/lib/actions/clients";

import { ClientsList } from "./clients-list";

export const metadata: Metadata = {
    title: "Clients",
};

export default async function ClientsPage() {
    const clients = await getClientsWithWebsites();

    return (
        <PageContainer>
            <ClientsList clients={clients} />
        </PageContainer>
    );
}
