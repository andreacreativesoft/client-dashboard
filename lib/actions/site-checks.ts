"use server";

import { createClient } from "@/lib/supabase/server";
import type { SiteCheck, CheckType } from "@/types/database";

export async function getSiteChecks(
  websiteId: string,
  checkType: CheckType,
  limit = 5
): Promise<SiteCheck[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_checks")
    .select("*")
    .eq("website_id", websiteId)
    .eq("check_type", checkType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching site checks:", error);
    return [];
  }

  return (data || []) as SiteCheck[];
}

export async function getLatestChecks(clientId: string): Promise<SiteCheck[]> {
  const supabase = await createClient();

  // Get latest check of each type per website for this client
  const { data, error } = await supabase
    .from("site_checks")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching latest checks:", error);
    return [];
  }

  // Deduplicate: keep only latest per website+type combo
  const seen = new Set<string>();
  const latest: SiteCheck[] = [];

  for (const check of (data || []) as SiteCheck[]) {
    const key = `${check.website_id}:${check.check_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      latest.push(check);
    }
  }

  return latest;
}

export async function getLatestCheckForWebsite(
  websiteId: string,
  checkType: CheckType
): Promise<SiteCheck | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_checks")
    .select("*")
    .eq("website_id", websiteId)
    .eq("check_type", checkType)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest check:", error);
    return null;
  }

  return (data as SiteCheck) || null;
}

export async function getAllSiteChecks(limit = 20): Promise<SiteCheck[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_checks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching all site checks:", error);
    return [];
  }

  return (data || []) as SiteCheck[];
}
