"use server";

import { createClient } from "@/lib/supabase/server";

export type NavBadgeCounts = {
  newLeads: number;
  openTickets: number;
};

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const supabase = await createClient();

  const [leadsResult, ticketsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  return {
    newLeads: leadsResult.count ?? 0,
    openTickets: ticketsResult.count ?? 0,
  };
}
