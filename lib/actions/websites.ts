"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/actions/activity";
import { requireAdmin } from "@/lib/auth";
import { ActivityTypes } from "@/lib/constants/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Website, WebsitePlatform } from "@/types/database";

export type WebsiteFormData = {
    name: string;
    url: string;
    platform: WebsitePlatform;
};

export async function getWebsitesForClient(clientId: string): Promise<Website[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("websites")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .overrideTypes<Website[], { merge: false }>();

    if (error) {
        console.error("Error fetching websites:", error);
        return [];
    }

    return data || [];
}

export async function createWebsiteAction(
    clientId: string,
    formData: WebsiteFormData,
): Promise<{ success: boolean; error?: string; website?: Website }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("websites")
        .insert({
            client_id: clientId,
            name: formData.name,
            url: formData.url,
            platform: formData.platform || "wordpress",
            is_active: true,
        })
        .select()
        .single<Website>();

    if (error) {
        console.error("Error creating website:", error);
        return { success: false, error: error.message };
    }

    await logActivity({
        clientId,
        actionType: ActivityTypes.WEBSITE_ADDED,
        metadata: {
            websiteId: data.id,
            clientId,
            websiteName: data.name,
            url: data.url,
            platform: data.platform,
        },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/websites");
    return { success: true, website: data };
}

export async function updateWebsiteAction(
    id: string,
    formData: WebsiteFormData,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { data: website } = await supabase
        .from("websites")
        .select("client_id")
        .eq("id", id)
        .single<{ client_id: string }>();

    const { error } = await supabase
        .from("websites")
        .update({
            name: formData.name,
            url: formData.url,
            platform: formData.platform,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating website:", error);
        return { success: false, error: error.message };
    }

    if (website) {
        await logActivity({
            clientId: website.client_id,
            actionType: ActivityTypes.WEBSITE_UPDATED,
            metadata: { websiteId: id, clientId: website.client_id, websiteName: formData.name },
        });
        revalidatePath(`/admin/clients/${website.client_id}`);
    }
    revalidatePath("/admin/websites");
    return { success: true };
}

export async function deleteWebsiteAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { data: website } = await supabase
        .from("websites")
        .select("client_id, name")
        .eq("id", id)
        .single<{ client_id: string; name: string }>();

    const { error } = await supabase.from("websites").delete().eq("id", id);

    if (error) {
        console.error("Error deleting website:", error);
        return { success: false, error: error.message };
    }

    if (website) {
        await logActivity({
            clientId: website.client_id,
            actionType: ActivityTypes.WEBSITE_REMOVED,
            metadata: { websiteId: id, clientId: website.client_id, websiteName: website.name },
        });
        revalidatePath(`/admin/clients/${website.client_id}`);
    }
    revalidatePath("/admin/websites");
    return { success: true };
}

export async function toggleWebsiteActiveAction(
    id: string,
    isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.success) return { success: false, error: auth.error };

    const supabase = await createClient();

    const { error } = await supabase.from("websites").update({ is_active: isActive }).eq("id", id);

    if (error) {
        console.error("Error toggling website:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/admin/websites");
    return { success: true };
}
