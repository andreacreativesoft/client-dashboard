"use server";

import { revalidatePath } from "next/cache";

import { getProfile } from "@/lib/actions/profile";
import { missingDataScopes } from "@/lib/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/view-context";
import type { ConnectedAccount } from "@/types/database";

/** Vue UI d'un credential : jamais les tokens, juste de quoi le gérer/binder. */
export type ConnectedAccountSummary = {
    id: string;
    provider: string;
    label: string | null;
    /** null = compte global/agence. */
    clientId: string | null;
    clientName: string | null;
    isGlobal: boolean;
    createdBy: string | null;
    scopes: string[];
    /** Scopes de données requis mais non accordés (vide = suffisant). */
    missingScopes: string[];
    metadata: Record<string, unknown>;
    createdAt: string;
};

type Row = Pick<
    ConnectedAccount,
    | "id"
    | "provider"
    | "external_account_label"
    | "client_id"
    | "created_by"
    | "scopes"
    | "metadata"
    | "created_at"
> & { client?: { business_name: string } | { business_name: string }[] | null };

/** Colonnes sûres (sans tokens) sélectionnées pour l'UI. */
const SAFE_COLUMNS =
    "id, provider, external_account_label, client_id, created_by, scopes, metadata, created_at";

function toSummary(a: Row): ConnectedAccountSummary {
    const client = Array.isArray(a.client) ? a.client[0] : a.client;
    return {
        id: a.id,
        provider: a.provider,
        label: a.external_account_label,
        clientId: a.client_id,
        clientName: client?.business_name ?? null,
        isGlobal: a.client_id === null,
        createdBy: a.created_by,
        scopes: a.scopes,
        missingScopes: missingDataScopes(a.scopes),
        metadata: a.metadata,
        createdAt: a.created_at,
    };
}

/**
 * Tous les comptes connectés de l'app (globaux + spécifiques clients).
 * Admin uniquement — pour la page de gestion agence.
 */
export async function getAllConnectedAccounts(): Promise<ConnectedAccountSummary[]> {
    const profile = await getProfile();
    if (profile?.role !== "admin") return [];

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("connected_accounts")
        .select(`${SAFE_COLUMNS}, client:clients(business_name)`)
        .eq("is_active", true)
        .order("client_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch connected accounts:", error);
        return [];
    }
    return (data as unknown as Row[]).map(toSummary);
}

/**
 * Comptes **spécifiques** d'un client (hors globaux). Admin uniquement — pour la
 * carte « Compte Google » de la fiche client.
 */
export async function getConnectedAccountsForClient(
    clientId: string,
): Promise<ConnectedAccountSummary[]> {
    const profile = await getProfile();
    if (profile?.role !== "admin") return [];

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("connected_accounts")
        .select(`${SAFE_COLUMNS}, client:clients(business_name)`)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch client connected accounts:", error);
        return [];
    }
    return (data as unknown as Row[]).map(toSummary);
}

/**
 * Comptes liables aux intégrations d'un **site** donné. Marche pour l'admin comme
 * pour le client propriétaire :
 * - **admin** : comptes spécifiques du client du site + comptes globaux/agence ;
 * - **client** : uniquement ses propres comptes (jamais les globaux) ;
 * - autre : rien.
 */
export async function getBindableAccountsForWebsite(
    websiteId: string,
): Promise<ConnectedAccountSummary[]> {
    const profile = await getProfile();
    if (!profile) return [];

    const supabase = createAdminClient();
    const { data: website } = await supabase
        .from("websites")
        .select("client_id")
        .eq("id", websiteId)
        .maybeSingle<{ client_id: string }>();
    if (!website) return [];

    if (profile.role !== "admin") {
        const activeClientId = await getActiveClientId();
        if (activeClientId !== website.client_id) return [];
    }

    // Admin : comptes du client + globaux. Client : uniquement ses comptes.
    const filter =
        profile.role === "admin"
            ? `client_id.eq.${website.client_id},client_id.is.null`
            : `client_id.eq.${website.client_id}`;

    const { data, error } = await supabase
        .from("connected_accounts")
        .select(`${SAFE_COLUMNS}, client:clients(business_name)`)
        .eq("is_active", true)
        .or(filter)
        .order("client_id", { ascending: true, nullsFirst: true });

    if (error) {
        console.error("Failed to fetch bindable accounts:", error);
        return [];
    }
    return (data as unknown as Row[]).map(toSummary);
}

/**
 * Comptes du client courant (côté paramètres avancés client). Ne renvoie que
 * les comptes spécifiques à son commerce — jamais les comptes globaux.
 */
export async function getMyConnectedAccounts(): Promise<ConnectedAccountSummary[]> {
    const clientId = await getActiveClientId();
    if (!clientId) return [];

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("connected_accounts")
        .select(`${SAFE_COLUMNS}, client:clients(business_name)`)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch client connected accounts:", error);
        return [];
    }
    return (data as unknown as Row[]).map(toSummary);
}

/**
 * Déconnecte un credential (les liaisons `integrations` tombent en cascade).
 * Admin : n'importe quel compte. Client : uniquement un compte de son commerce
 * (jamais un compte global).
 */
export async function disconnectAccount(
    accountId: string,
): Promise<{ success: boolean; error?: string }> {
    const profile = await getProfile();
    if (!profile) return { success: false, error: "Not authenticated" };

    const supabase = createAdminClient();
    const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, client_id")
        .eq("id", accountId)
        .maybeSingle<{ id: string; client_id: string | null }>();

    if (!account) return { success: false, error: "Compte introuvable" };

    if (profile.role !== "admin") {
        const activeClientId = await getActiveClientId();
        if (account.client_id === null || account.client_id !== activeClientId) {
            return { success: false, error: "Not authorized" };
        }
    }

    const { error } = await supabase.from("connected_accounts").delete().eq("id", accountId);
    if (error) {
        console.error("Failed to disconnect account:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/admin/connections");
    revalidatePath("/settings/connections");
    if (account.client_id) revalidatePath(`/admin/clients/${account.client_id}`);
    return { success: true };
}
