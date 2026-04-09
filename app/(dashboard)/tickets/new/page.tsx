import type { Metadata } from "next";
import { getProfile } from "@/lib/actions/profile";
import { getClientsForTickets, getAdminUsers } from "@/lib/actions/tickets";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { TicketForm } from "./ticket-form";

export const metadata: Metadata = {
  title: "New Ticket",
};

export default async function NewTicketPage() {
  const profile = await getProfile();
  const impersonatedClientId = profile?.role === "admin" ? await getImpersonatedClientId() : null;
  const isAdmin = profile?.role === "admin" && !impersonatedClientId;

  const clients = await getClientsForTickets();
  const adminUsers = isAdmin ? await getAdminUsers() : [];

  return (
    <div className="px-8 py-12 font-[Helvetica,Arial,sans-serif]">
      <div className="flex flex-col gap-8">
        {/* Heading */}
        <div className="flex flex-col gap-4 px-4">
          <h1
            className="text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]"
            style={{ fontFamily: "var(--font-mplus1), sans-serif" }}
          >
            Demander des modifications
          </h1>
          <p className="text-[18px] leading-[1.5] text-[#6D6A65]">
            Décrivez-nous les changements que vous souhaitez apporter à votre site web.
            <br />
            Notre équipe vous répondra rapidement.
          </p>
        </div>

        {/* Form card */}
        <div className="overflow-hidden rounded-[8px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
          <div className="p-8">
            <TicketForm
              clients={clients}
              adminUsers={adminUsers}
              isAdmin={isAdmin}
              defaultClientId={impersonatedClientId || (clients.length === 1 ? clients[0]!.id : undefined)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
