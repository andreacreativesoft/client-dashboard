import type { Metadata } from "next";

import { TicketForm } from "@/components/tickets/ticket-form";
import { PageContainer, PageTitle, PageSubtitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { getClientsForTickets, getAdminUsers } from "@/lib/actions/tickets";
import { t } from "@/lib/i18n/translations";

export const metadata: Metadata = {
    title: "Nouveau ticket — Admin",
};

export default async function AdminNewTicketPage() {
    // Reachable only in agency mode (guarded by the /admin layout).
    const profile = await getProfile();
    const lang = profile?.language || "fr-BE";

    const [clients, adminUsers] = await Promise.all([getClientsForTickets(), getAdminUsers()]);

    return (
        <PageContainer>
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-4 px-4">
                    <PageTitle>{t(lang, "ticket_form.title")}</PageTitle>
                    <PageSubtitle>{t(lang, "ticket_form.subtitle")}</PageSubtitle>
                </div>

                <div className="overflow-hidden rounded-[8px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                        <TicketForm
                            clients={clients}
                            adminUsers={adminUsers}
                            isAdmin
                            basePath="/admin/tickets"
                            defaultClientId={clients.length === 1 ? clients[0]!.id : undefined}
                        />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
