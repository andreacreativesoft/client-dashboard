import type { Metadata } from "next";
import { getClients } from "@/lib/actions/clients";
import { ClientsList } from "./clients-list";

export const metadata: Metadata = {
  title: "Clients",
};

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="p-4 md:p-6">
      <ClientsList clients={clients} />
    </div>
  );
}
