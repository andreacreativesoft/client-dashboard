"use server";

import { createClient } from "@/lib/supabase/server";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { getProfile } from "@/lib/actions/profile";

export type NavBadgeCounts = {
  newLeads: number;
  openTickets: number;
};

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const supabase = await createClient();

  // Check if admin is impersonating a client
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  let leadsQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  let ticketsQuery = supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  // Filter by impersonated client when viewing as client
  if (impersonatedClientId) {
    leadsQuery = leadsQuery.eq("client_id", impersonatedClientId);
    ticketsQuery = ticketsQuery.eq("client_id", impersonatedClientId);
  }

  const [leadsResult, ticketsResult] = await Promise.all([
    leadsQuery,
    ticketsQuery,
  ]);

  return {
    newLeads: leadsResult.count ?? 0,
    openTickets: ticketsResult.count ?? 0,
  };
}
