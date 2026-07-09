"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { requireAdmin } from "@/lib/auth";
import { ActivityTypes } from "@/lib/constants/activity";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database";

export type ClientFormData = {
    business_name: string;
    contact_email: string;
    contact_phone: string;
    notes: string;
};

export async function getClients(): Promise<Client[]> {
    const auth = await requireAdmin();
    if (!auth.success) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .overrideTypes<Client[], { merge: false }>();

    if (error) {
        console.error("Error fetching clients:", error);
        return [];
    }

    return data || [];
}

export type ClientWithWebsites = Client & {
    websites: { id: string; name: string }[];
};

export async function getClientsWithWebsites(): Promise<ClientWithWebsites[]> {
    const auth = await requireAdmin();
    if (!auth.success) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("clients")
        .select("*, websites(id, name)")
        .order("created_at", { ascending: false })
        .overrideTypes<ClientWithWebsites[], { merge: false }>();

    if (error) {
        console.error("Error fetching clients with websites:", error);
        return [];
    }

    return data || [];
}

export async function getClient(id: string): Promise<Client | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single<Client>();

    if (error) {
        console.error("Error fetching client:", error);
        return null;
    }

    return data;
}

export async function createClientAction(
    formData: ClientFormData,
): Promise<{ success: boolean; error?: string; client?: Client }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("clients")
        .insert({
            business_name: formData.business_name,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            notes: formData.notes || null,
            created_by: auth.userId,
        })
        .select()
        .single<Client>();

    if (error) {
        console.error("Error creating client:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: data.id,
        actionType: ActivityTypes.CLIENT_CREATED,
        metadata: { clientId: data.id, clientName: data.business_name, createdBy: auth.userId },
    });

    revalidatePath("/admin/clients");
    return { success: true, client: data };
}

export async function updateClientAction(
    id: string,
    formData: ClientFormData,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { error } = await supabase
        .from("clients")
        .update({
            business_name: formData.business_name,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            notes: formData.notes || null,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating client:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId: id,
        actionType: ActivityTypes.CLIENT_UPDATED,
        metadata: { clientId: id, clientName: formData.business_name, updatedBy: auth.userId },
    });

    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${id}`);
    return { success: true };
}

/** Focused update of a client's contact details (email + phone) from the client page. */
export async function updateClientContactAction(
    id: string,
    contact: { email: string; phone: string },
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { error } = await supabase
        .from("clients")
        .update({
            contact_email: contact.email.trim() || null,
            contact_phone: contact.phone.trim() || null,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating client contact:", error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/admin/clients/${id}`);
    return { success: true };
}

export async function deleteClientAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
        console.error("Error deleting client:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/admin/clients");
    return { success: true };
}

export async function updateClientNotesAction(
    id: string,
    notes: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { error } = await supabase
        .from("clients")
        .update({ notes: notes || null })
        .eq("id", id);

    if (error) {
        console.error("Error updating client notes:", error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/admin/clients/${id}`);
    return { success: true };
}
