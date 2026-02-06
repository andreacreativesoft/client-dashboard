import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the current user is authenticated and has admin role.
 * Use in any server action that requires admin privileges.
 *
 * @returns The authenticated admin user's ID, or an error object.
 */
export async function requireAdmin(): Promise<
  { success: true; userId: string } | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Not authorized" };
  }

  return { success: true, userId: user.id };
}
