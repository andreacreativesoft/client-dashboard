"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { getProfile } from "@/lib/actions/profile";
import { ActivityTypes } from "@/lib/constants/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/view-context";
import type { AnalyticsService, Integration } from "@/types/database";

/**
 * Toutes les liaisons analytics d'un site. Lecture RLS-scopée : un admin voit
 * tout, un client voit celles de ses propres sites.
 */
export async function getIntegrationsForWebsite(websiteId: string): Promise<Integration[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("website_id", websiteId)
        .order("service", { ascending: true });

    if (error) {
        console.error("Failed to fetch integrations:", error);
        return [];
    }
    return (data || []) as Integration[];
}

/**
 * Autorise l'acteur courant à gérer les liaisons d'un site avec un compte donné,
 * et renvoie le client_id du site. Règles :
 * - **admin** : compte global → n'importe quel site ; compte spécifique →
 *   uniquement les sites de son client.
 * - **client** : uniquement ses propres sites, avec ses propres comptes
 *   (spécifiques à son commerce) — jamais un compte global.
 */
async function authorizeBinding(
    websiteId: string,
    accountId: string,
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
    const profile = await getProfile();
    if (!profile) return { ok: false, error: "Not authenticated" };

    const admin = createAdminClient();
    const [{ data: website }, { data: account }] = await Promise.all([
        admin
            .from("websites")
            .select("client_id")
            .eq("id", websiteId)
            .maybeSingle<{ client_id: string }>(),
        admin
            .from("connected_accounts")
            .select("client_id")
            .eq("id", accountId)
            .maybeSingle<{ client_id: string | null }>(),
    ]);

    if (!website) return { ok: false, error: "Site introuvable" };
    if (!account) return { ok: false, error: "Compte introuvable" };

    const accountUsable = account.client_id === null || account.client_id === website.client_id;

    if (profile.role === "admin") {
        if (!accountUsable) return { ok: false, error: "Ce compte n'est pas liable à ce site" };
        return { ok: true, clientId: website.client_id };
    }

    // Client : son propre site + son propre compte (non global).
    const activeClientId = await getActiveClientId();
    if (activeClientId !== website.client_id) return { ok: false, error: "Not authorized" };
    if (account.client_id !== website.client_id) {
        return { ok: false, error: "Not authorized" };
    }
    return { ok: true, clientId: website.client_id };
}

/**
 * Lie un site à une ressource analytics (propriété GA4 / location GBP / site GSC)
 * via un connected_account. Upsert : une seule liaison active par (site, service).
 */
export async function bindIntegration(params: {
    websiteId: string;
    accountId: string;
    service: AnalyticsService;
    resourceId: string;
    resourceLabel: string;
}): Promise<{ success: boolean; error?: string }> {
    const auth = await authorizeBinding(params.websiteId, params.accountId);
    if (!auth.ok) return { success: false, error: auth.error };

    const supabase = createAdminClient();

    // Remplace une éventuelle liaison existante pour ce (site, service).
    await supabase
        .from("integrations")
        .delete()
        .eq("website_id", params.websiteId)
        .eq("service", params.service);

    const { error } = await supabase.from("integrations").insert({
        website_id: params.websiteId,
        account_id: params.accountId,
        service: params.service,
        resource_id: params.resourceId,
        resource_label: params.resourceLabel,
        is_active: true,
    });

    if (error) {
        console.error("Failed to bind integration:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: auth.clientId,
        actionType: ActivityTypes.INTEGRATION_CONNECTED,
        metadata: {
            clientId: auth.clientId,
            websiteId: params.websiteId,
            service: params.service,
            resourceId: params.resourceId,
            resourceLabel: params.resourceLabel,
        },
    });

    revalidatePath(`/admin/clients/${auth.clientId}`);
    revalidatePath("/settings/connections");
    return { success: true };
}

export async function deleteIntegration(
    integrationId: string,
): Promise<{ success: boolean; error?: string }> {
    const profile = await getProfile();
    if (!profile) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: integration } = await admin
        .from("integrations")
        .select("service, account_id, website:websites!website_id(client_id)")
        .eq("id", integrationId)
        .maybeSingle<{
            service: string;
            account_id: string;
            website: { client_id: string } | null;
        }>();

    if (!integration?.website) return { success: false, error: "Liaison introuvable" };
    const clientId = integration.website.client_id;

    // Admin : autorisé partout. Client : uniquement les liaisons de ses sites.
    if (profile.role !== "admin") {
        const activeClientId = await getActiveClientId();
        if (activeClientId !== clientId) return { success: false, error: "Not authorized" };
    }

    const { error } = await admin.from("integrations").delete().eq("id", integrationId);
    if (error) {
        console.error("Failed to delete integration:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId,
        actionType: ActivityTypes.INTEGRATION_DISCONNECTED,
        metadata: { integrationId, clientId, service: integration.service },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/settings/connections");
    return { success: true };
}
