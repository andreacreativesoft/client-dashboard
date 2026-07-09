"use server";

import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { createClient } from "@/lib/supabase/server";

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

    let submissionsQuery = supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

    let ticketsQuery = supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

    // Filter by impersonated client when viewing as client
    if (impersonatedClientId) {
        submissionsQuery = submissionsQuery.eq("client_id", impersonatedClientId);
        ticketsQuery = ticketsQuery.eq("client_id", impersonatedClientId);
    }

    const [submissionsResult, ticketsResult] = await Promise.all([submissionsQuery, ticketsQuery]);

    return {
        newLeads: submissionsResult.count ?? 0,
        openTickets: ticketsResult.count ?? 0,
    };
}
