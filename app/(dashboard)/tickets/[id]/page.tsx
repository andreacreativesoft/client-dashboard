import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TicketDetail } from "@/components/tickets/ticket-detail";
import { getTicket, getTicketReplies } from "@/lib/actions/tickets";
import { requireClientView } from "@/lib/view-context";

export const metadata: Metadata = {
    title: "Demande",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
    const { profile } = await requireClientView();

    const { id } = await params;
    const [ticket, replies] = await Promise.all([getTicket(id), getTicketReplies(id)]);

    if (!ticket) {
        notFound();
    }

    return (
        <TicketDetail
            ticket={ticket}
            replies={replies}
            websites={[]}
            isAdmin={false}
            lang={profile.language || "fr-BE"}
            backHref="/tickets"
            backLabel="Retour aux demandes"
            currentUser={{
                name: profile.full_name || "",
                avatar: profile.avatar_url || null,
            }}
            adminUsers={[]}
        />
    );
}
