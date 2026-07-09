"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { requireAdmin } from "@/lib/auth";
import { ActivityTypes } from "@/lib/constants/activity";
import { createClient } from "@/lib/supabase/server";
import type { Attribute } from "@/types/database";

export type AttributeFormData = {
    type: string | null;
    title: string;
    value: string;
    is_sensitive: boolean;
    is_admin_only: boolean;
};

/** Attributs d'un site (RLS : admin voit tout, client voit le non-admin-only). */
export async function getAttributesForWebsite(websiteId: string): Promise<Attribute[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("attributes")
        .select("*")
        .eq("website_id", websiteId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .overrideTypes<Attribute[], { merge: false }>();

    if (error) {
        console.error("Error fetching attributes:", error);
        return [];
    }
    return data || [];
}

async function clientIdForWebsite(websiteId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("websites")
        .select("client_id")
        .eq("id", websiteId)
        .single<{ client_id: string }>();
    return data?.client_id ?? null;
}

export async function addAttributeAction(
    websiteId: string,
    formData: AttributeFormData,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase.from("attributes").insert({
        website_id: websiteId,
        type: formData.type,
        title: formData.title,
        value: formData.value,
        is_sensitive: formData.is_sensitive,
        is_admin_only: formData.is_admin_only,
    });

    if (error) {
        console.error("Error adding attribute:", error);
        return { success: false, error: error.message };
    }

    const clientId = await clientIdForWebsite(websiteId);
    await logActivity({
        clientId,
        actionType: ActivityTypes.ATTRIBUTE_ADDED,
        metadata: { clientId, websiteId, title: formData.title },
    });
    if (clientId) revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
}

export async function updateAttributeAction(
    id: string,
    formData: AttributeFormData,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase
        .from("attributes")
        .update({
            type: formData.type,
            title: formData.title,
            value: formData.value,
            is_sensitive: formData.is_sensitive,
            is_admin_only: formData.is_admin_only,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating attribute:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function deleteAttributeAction(
    id: string,
    websiteId: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase.from("attributes").delete().eq("id", id);

    if (error) {
        console.error("Error deleting attribute:", error);
        return { success: false, error: error.message };
    }

    const clientId = await clientIdForWebsite(websiteId);
    await logActivity({
        clientId,
        actionType: ActivityTypes.ATTRIBUTE_REMOVED,
        metadata: { clientId, websiteId, attributeId: id },
    });
    if (clientId) revalidatePath(`/admin/clients/${clientId}`);
    return { success: true };
}
