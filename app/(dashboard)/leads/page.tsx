import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLeads } from "@/lib/actions/leads";
import { LeadsList } from "./leads-list";

export const metadata: Metadata = {
  title: "Leads",
};

export default async function LeadsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id || "")
    .single<{ role: string }>();

  const isAdmin = profile?.role === "admin";
  const leads = await getLeads();

  return (
    <div className="p-4 md:p-6">
      <LeadsList leads={leads} isAdmin={isAdmin} />
    </div>
  );
}
