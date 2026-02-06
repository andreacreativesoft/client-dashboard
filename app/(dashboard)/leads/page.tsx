import type { Metadata } from "next";
import { getLeadsPaginated } from "@/lib/actions/leads";
import { getProfile } from "@/lib/actions/profile";
import { LeadsList } from "./leads-list";

export const metadata: Metadata = {
  title: "Leads",
};

interface LeadsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const statusFilter = params.status as "new" | "contacted" | "done" | "all" | undefined;

  const result = await getLeadsPaginated(
    { status: statusFilter || "all" },
    page
  );

  return (
    <div className="p-4 md:p-6">
      <LeadsList
        leads={result.leads}
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
