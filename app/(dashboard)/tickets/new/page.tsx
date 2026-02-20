import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/actions/profile";
import { getClientsForTickets, getAdminUsers } from "@/lib/actions/tickets";
import { TicketForm } from "./ticket-form";

export const metadata: Metadata = {
  title: "New Ticket",
};

export default async function NewTicketPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  const clients = await getClientsForTickets();
  const adminUsers = isAdmin ? await getAdminUsers() : [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link
          href="/tickets"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Tickets
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">New Ticket</h1>

      <TicketForm
        clients={clients}
        adminUsers={adminUsers}
        isAdmin={isAdmin}
        defaultClientId={clients.length === 1 ? clients[0]!.id : undefined}
      />
    </div>
  );
}
