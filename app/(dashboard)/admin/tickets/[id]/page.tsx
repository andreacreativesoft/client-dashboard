import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TicketDetail } from "@/components/tickets/ticket-detail";
import { getProfile } from "@/lib/actions/profile";
import { getAdminUsers, getTicket, getTicketReplies } from "@/lib/actions/tickets";
import { getWebsitesForClient } from "@/lib/actions/websites";

export const metadata: Metadata = {
    title: "Ticket — Admin",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({ params }: PageProps) {
    // Reachable only in agency mode (guarded by the /admin layout).
    const { id } = await params;
    const [ticket, replies, profile, adminUsers] = await Promise.all([
        getTicket(id),
        getTicketReplies(id),
        getProfile(),
        getAdminUsers(),
    ]);

    if (!ticket) {
        notFound();
    }

    const websites = await getWebsitesForClient(ticket.client_id);

    return (
        <TicketDetail
            ticket={ticket}
            replies={replies}
            websites={websites}
            isAdmin
            lang={profile?.language || "fr-BE"}
            backHref="/admin/tickets"
            backLabel="Retour aux tickets"
            currentUser={{
                name: profile?.full_name || "",
                avatar: profile?.avatar_url || null,
            }}
            adminUsers={adminUsers}
        />
    );
}
