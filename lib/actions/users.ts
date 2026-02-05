"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email";
import type { Profile, Client, ClientUser } from "@/types/database";

export type UserWithClients = Profile & {
  clients: { id: string; business_name: string; access_role: string }[];
};

export type UserFormData = {
  email: string;
  full_name: string;
  phone: string;
  role: "admin" | "client";
  password: string;
  client_ids: string[];
};

export async function getUsers(): Promise<UserWithClients[]> {
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  if (error || !profiles) {
    console.error("Error fetching profiles:", error);
    return [];
  }

  // Get client associations for each user
  const usersWithClients: UserWithClients[] = [];

  for (const profile of profiles) {
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("client_id, access_role")
      .eq("user_id", profile.id)
      .returns<{ client_id: string; access_role: string }[]>();

    const clients: { id: string; business_name: string; access_role: string }[] = [];

    if (clientUsers && clientUsers.length > 0) {
      for (const cu of clientUsers) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, business_name")
          .eq("id", cu.client_id)
          .single<{ id: string; business_name: string }>();

        if (client) {
          clients.push({
            id: client.id,
            business_name: client.business_name,
            access_role: cu.access_role,
          });
        }
      }
    }

    usersWithClients.push({ ...profile, clients });
  }

  return usersWithClients;
}

export async function createUserAction(
  formData: UserFormData
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
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

  // Send welcome email with credentials
  await sendWelcomeEmail(formData.email, {
    userName: formData.full_name,
    email: formData.email,
    password: formData.password,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserRoleAction(
  userId: string,
  role: "admin" | "client"
): Promise<{ success: boolean; error?: string }> {
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
