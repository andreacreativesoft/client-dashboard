"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { requireAdmin } from "@/lib/auth";
import { listParsers } from "@/lib/connectors";
import { ActivityTypes } from "@/lib/constants/activity";
import { createClient } from "@/lib/supabase/server";
import type { Connector, ConnectorKind } from "@/types/database";

/** Connecteur + son URL d'ingestion dédiée (kind + token) + dernière récolte. */
export type ConnectorWithUrl = Connector & {
    ingestUrl: string;
    /** Horodatage de la dernière soumission reçue (null si aucune). */
    lastSubmissionAt: string | null;
};

function ingestUrlFor(kind: string, token: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${base}/api/ingest/${kind}/${token}`;
}

/** Types de connecteurs disponibles (registry) pour le formulaire de création. */
export async function getConnectorKinds(): Promise<
    Array<{ kind: string; displayName: string; defaultLabel: string }>
> {
    return listParsers().map((p) => ({
        kind: p.kind,
        displayName: p.displayName,
        defaultLabel: p.defaultLabel,
    }));
}

/** Connecteurs (portes de collecte) d'un site — admin only (contient des secrets). */
export async function getConnectorsForWebsite(websiteId: string): Promise<ConnectorWithUrl[]> {
    const auth = await requireAdmin();
    if (!auth.success) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("connectors")
        .select("*")
        .eq("website_id", websiteId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Failed to fetch connectors:", error);
        return [];
    }

    const connectors = (data || []) as Connector[];

    // Dernière récolte reçue par connecteur (requête légère limit(1) par connecteur,
    // leur nombre par site étant faible).
    return Promise.all(
        connectors.map(async (c) => {
            const { data: last } = await supabase
                .from("submissions")
                .select("submitted_at")
                .eq("connector_id", c.id)
                .order("submitted_at", { ascending: false })
                .limit(1)
                .maybeSingle<{ submitted_at: string }>();
            return {
                ...c,
                ingestUrl: ingestUrlFor(c.kind, c.ingest_token),
                lastSubmissionAt: last?.submitted_at ?? null,
            };
        }),
    );
}

export async function createConnectorAction(params: {
    websiteId: string;
    clientId: string;
    kind: ConnectorKind;
    name: string;
    label: string;
}): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase.from("connectors").insert({
        website_id: params.websiteId,
        kind: params.kind,
        name: params.name,
        label: params.label,
    });

    if (error) {
        console.error("Failed to create connector:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: params.clientId,
        actionType: ActivityTypes.CONNECTOR_CREATED,
        metadata: {
            clientId: params.clientId,
            websiteId: params.websiteId,
            kind: params.kind,
            name: params.name,
        },
    });

    revalidatePath(`/admin/clients/${params.clientId}`);
    return { success: true };
}

export async function updateConnectorAction(
    id: string,
    clientId: string,
    patch: { name?: string; label?: string; is_active?: boolean; config?: Record<string, unknown> },
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase.from("connectors").update(patch).eq("id", id);

    if (error) {
        console.error("Failed to update connector:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId,
        actionType: ActivityTypes.CONNECTOR_UPDATED,
        metadata: { clientId, connectorId: id },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
}

export async function regenerateIngestTokenAction(
    id: string,
    clientId: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const token = randomBytes(32).toString("hex");
    const { error } = await supabase
        .from("connectors")
        .update({ ingest_token: token })
        .eq("id", id);

    if (error) {
        console.error("Failed to regenerate ingest token:", error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
}

export async function deleteConnectorAction(
    id: string,
    clientId: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase.from("connectors").delete().eq("id", id);

    if (error) {
        console.error("Failed to delete connector:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId,
        actionType: ActivityTypes.CONNECTOR_DELETED,
        metadata: { clientId, connectorId: id },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
}
