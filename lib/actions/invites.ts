"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { format } from "date-fns";
import type { Invite } from "@/types/database";

export type InviteFormData = {
  email: string;
  full_name?: string; // Optional - user fills when accepting if not provided
  phone?: string;
  role: "admin" | "client";
  client_ids: string[];
};

export async function createInviteAction(
  formData: InviteFormData
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get inviter's name
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .single();

  // Check if user already exists
  const adminClient = createAdminClient();
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === formData.email.toLowerCase()
  );

  if (existingUser) {
    return { success: false, error: "A user with this email already exists" };
  }

  // Check if there's a pending invite for this email
  const { data: existingInvite } = await supabase
    .from("invites")
    .select("id")
    .eq("email", formData.email.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existingInvite) {
    return { success: false, error: "An invitation has already been sent to this email" };
  }

  // Create the invite
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const { data: invite, error: insertError } = await adminClient
    .from("invites")
    .insert({
      email: formData.email.toLowerCase(),
      full_name: formData.full_name || "", // Empty if not provided - user fills when accepting
      phone: formData.phone || null,
      role: formData.role,
      client_ids: formData.client_ids,
      invited_by: auth.userId,
      expires_at: expiresAt.toISOString(),
    })
    .select("token, expires_at")
    .single();

  if (insertError || !invite) {
    console.error("Error creating invite:", insertError);
    return { success: false, error: "Failed to create invitation" };
  }

  // Send the invite email
  const displayName = formData.full_name || formData.email.split("@")[0] || "there";
  const emailResult = await sendInviteEmail(formData.email, {
    inviteeName: displayName,
    inviterName: inviterProfile?.full_name || "An administrator",
    token: invite.token,
    expiresAt: format(new Date(invite.expires_at), "MMMM d, yyyy"),
  });

  if (!emailResult.success) {
    // Delete the invite if email failed
    await adminClient.from("invites").delete().eq("token", invite.token);
    return { success: false, error: emailResult.error || "Failed to send invitation email" };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function getInviteByToken(
  token: string
): Promise<{ invite: Invite | null; error?: string }> {
  const supabase = createAdminClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .single<Invite>();

  if (error || !invite) {
    return { invite: null, error: "Invitation not found" };
  }

  // Check if already accepted
  if (invite.accepted_at) {
    return { invite: null, error: "This invitation has already been used" };
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return { invite: null, error: "This invitation has expired" };
  }

  return { invite };
}

export type AcceptInviteData = {
  password: string;
  full_name?: string; // Required if not provided in invite
  phone?: string;
};

export async function acceptInviteAction(
  token: string,
  data: AcceptInviteData
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  // Get the invite
  const { invite, error: inviteError } = await getInviteByToken(token);

  if (!invite) {
    return { success: false, error: inviteError };
  }

  // Determine final name and phone
  const finalName = invite.full_name || data.full_name || "";
  const finalPhone = invite.phone || data.phone || null;

  if (!finalName) {
    return { success: false, error: "Full name is required" };
  }

  // Create the auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: invite.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: finalName,
    },
  });

  if (authError || !authData.user) {
    console.error("Error creating user from invite:", authError);
    return { success: false, error: authError?.message || "Failed to create account" };
  }

  // Update profile with role and phone
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      role: invite.role,
      full_name: finalName,
      phone: finalPhone,
    })
    .eq("id", authData.user.id);

  if (profileError) {
    console.error("Error updating profile:", profileError);
  }

  // Assign to clients
  if (invite.client_ids && invite.client_ids.length > 0 && invite.role === "client") {
    for (const clientId of invite.client_ids) {
      await adminClient.from("client_users").insert({
        user_id: authData.user.id,
        client_id: clientId,
        access_role: "owner",
      });
    }
  }

  // Mark invite as accepted
  await adminClient
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { success: true };
}

export async function resendInviteAction(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Get inviter's name
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .single();

  // Get the invite
  const { data: invite, error } = await adminClient
    .from("invites")
    .select("*")
    .eq("id", inviteId)
    .single<Invite>();

  if (error || !invite) {
    return { success: false, error: "Invitation not found" };
  }

  if (invite.accepted_at) {
    return { success: false, error: "This invitation has already been accepted" };
  }

  // Extend expiration
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  await adminClient
    .from("invites")
    .update({ expires_at: newExpiresAt.toISOString() })
    .eq("id", inviteId);

  // Resend email
  const resendDisplayName = invite.full_name || invite.email.split("@")[0] || "there";
  const emailResult = await sendInviteEmail(invite.email, {
    inviteeName: resendDisplayName,
    inviterName: inviterProfile?.full_name || "An administrator",
    token: invite.token,
    expiresAt: format(newExpiresAt, "MMMM d, yyyy"),
  });

  if (!emailResult.success) {
    return { success: false, error: emailResult.error || "Failed to send email" };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteInviteAction(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("invites")
    .delete()
    .eq("id", inviteId);

  if (error) {
    console.error("Error deleting invite:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function getPendingInvites(): Promise<Invite[]> {
  const auth = await requireAdmin();
  if (!auth.success) return [];

  // Use admin client to bypass RLS — this is already admin-only
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("invites")
    .select("*")
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .returns<Invite[]>();

  if (error) {
    // Table may not exist if migration 004_invites.sql hasn't been run
    return [];
  }

  return data || [];
}
