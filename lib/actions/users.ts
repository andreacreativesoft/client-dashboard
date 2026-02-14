"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import type { Profile } from "@/types/database";

export type UserWithClients = Profile & {
  clients: { id: string; business_name: string; access_role: string }[];
};

export type UserFormData = {
  email: string;
  full_name: string;
  phone: string;
  role: "admin" | "client";
  client_ids: string[];
};

export async function getUsers(): Promise<UserWithClients[]> {
  const auth = await requireAdmin();
  if (!auth.success) return [];

  const supabase = await createClient();

  // Single query: fetch all profiles with their client assignments joined
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  if (profilesError || !profiles) {
    console.error("Error fetching profiles:", profilesError);
    return [];
  }

  // Batch fetch all client_users with client details in one query
  const profileIds = profiles.map((p) => p.id);

  type ClientUserJoined = {
    user_id: string;
    access_role: string;
    clients: { id: string; business_name: string };
  };

  const { data: allClientUsers } = await supabase
    .from("client_users")
    .select("user_id, access_role, clients(id, business_name)")
    .in("user_id", profileIds)
    .returns<ClientUserJoined[]>();

  // Group client assignments by user_id
  const clientsByUser: Record<
    string,
    { id: string; business_name: string; access_role: string }[]
  > = {};

  if (allClientUsers) {
    for (const cu of allClientUsers) {
      if (!clientsByUser[cu.user_id]) {
        clientsByUser[cu.user_id] = [];
      }
      clientsByUser[cu.user_id]!.push({
        id: cu.clients.id,
        business_name: cu.clients.business_name,
        access_role: cu.access_role,
      });
    }
  }

  // Combine profiles with their client assignments
  return profiles.map((profile) => ({
    ...profile,
    clients: clientsByUser[profile.id] || [],
  }));
}

export async function createUserAction(
  formData: UserFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const adminClient = createAdminClient();

  // Generate a secure random temp password — never emailed or exposed
  const tempPassword = randomBytes(32).toString("base64url");

  // Create auth user with temp password
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: formData.full_name,
    },
  });

  if (authError || !authData.user) {
    console.error("Error creating auth user:", authError);
    return { success: false, error: authError?.message || "Failed to create user" };
  }

  // Update profile with role and phone
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      role: formData.role,
      full_name: formData.full_name,
      phone: formData.phone || null,
    })
    .eq("id", authData.user.id);

  if (profileError) {
    console.error("Error updating profile:", profileError);
    // Q1 Fix: Clean up orphaned auth user and return failure
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: "Failed to set up user profile. Please try again." };
  }

  // Assign to clients
  if (formData.client_ids.length > 0 && formData.role === "client") {
    for (const clientId of formData.client_ids) {
      await adminClient.from("client_users").insert({
        user_id: authData.user.id,
        client_id: clientId,
        access_role: "owner",
      });
    }
  }

  // Generate a password reset link so the user can set their own password
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: formData.email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/settings`,
    },
  });

  // Build the reset URL from the generated token
  let resetUrl = `${appUrl}/settings`; // Fallback
  if (!linkError && linkData?.properties?.hashed_token) {
    resetUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(`${appUrl}/auth/callback?next=/settings`)}`;
  }

  // Send welcome email with password reset link (never send the password)
  await sendWelcomeEmail(formData.email, {
    userName: formData.full_name,
    email: formData.email,
    resetUrl,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserRoleAction(
  userId: string,
  role: "admin" | "client"
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function assignUserToClientAction(
  userId: string,
  clientId: string,
  accessRole: "owner" | "viewer" = "owner"
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Check if already assigned
  const { data: existing } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .single();

  if (existing) {
    return { success: false, error: "User already assigned to this client" };
  }

  const { error } = await supabase.from("client_users").insert({
    user_id: userId,
    client_id: clientId,
    access_role: accessRole,
  });

  if (error) {
    console.error("Error assigning user to client:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function removeUserFromClientAction(
  userId: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("client_users")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (error) {
    console.error("Error removing user from client:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUserAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const adminClient = createAdminClient();

  // Delete from auth (this will cascade to profiles via trigger or we delete manually)
  const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

  if (authError) {
    console.error("Error deleting user:", authError);
    return { success: false, error: authError.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
