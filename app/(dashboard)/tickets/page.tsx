import type { Metadata } from "next";
import { getTicketsPaginated } from "@/lib/actions/tickets";
import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { TicketsList } from "./tickets-list";

export const metadata: Metadata = {
  title: "Tickets",
};

interface TicketsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    priority?: string;
  }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const impersonatedClientId = profile?.role === "admin" ? await getImpersonatedClientId() : null;
  const isAdmin = profile?.role === "admin" && !impersonatedClientId;

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const statusFilter = params.status as "open" | "in_progress" | "waiting_on_client" | "closed" | "all" | undefined;
  const priorityFilter = params.priority as "low" | "medium" | "high" | "urgent" | "all" | undefined;

  const result = await getTicketsPaginated(
    {
      status: statusFilter || "all",
      priority: priorityFilter || "all",
    },
    page
  );

  return (
    <div className="p-4 md:p-6">
      <TicketsList
        tickets={result.tickets}
        isAdmin={isAdmin}
        pagination={{
          page: result.page,
          perPage: result.perPage,
          total: result.total,
          totalPages: result.totalPages,
        }}
      />
    </div>
  );
}
