import type { Metadata } from "next";

import { TicketForm } from "@/components/tickets/ticket-form";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getClientsForTickets } from "@/lib/actions/tickets";
import { t } from "@/lib/i18n/translations";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Nouvelle demande",
};

export default async function NewTicketPage() {
    // Client-facing only — a client (or impersonating admin) files their own request.
    const { profile, impersonatedClientId } = await requireClientView();
    const lang = profile.language || "fr-BE";

    const clients = await getClientsForTickets();

    return (
        <PageContainer>
            <div className="flex flex-col gap-8">
                {/* Heading */}
                <div className="flex flex-col gap-4 px-4">
                    <PageTitle>{t(lang, "ticket_form.title")}</PageTitle>
                    <PageSubtitle>{t(lang, "ticket_form.subtitle")}</PageSubtitle>
                </div>

                {/* Form card */}
                <div className="overflow-hidden rounded-[8px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                        <TicketForm
                            clients={clients}
                            adminUsers={[]}
                            isAdmin={false}
                            defaultClientId={
                                impersonatedClientId ||
                                (clients.length === 1 ? clients[0]!.id : undefined)
                            }
                        />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
