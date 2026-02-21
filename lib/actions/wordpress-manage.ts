"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { WPClient, encryptCredentials } from "@/lib/wordpress/wp-client";
import { logActivity } from "@/lib/actions/activity";
import { ActivityTypes } from "@/lib/constants/activity";
import type { ConnectWordPressInput, WordPressCredentialsEncrypted } from "@/types/wordpress";
import type { Integration } from "@/types/database";

// ---------------------------------------------------------------------------
// Connect WordPress — creates integration + credentials, tests connection
// ---------------------------------------------------------------------------

export async function connectWordPress(
  input: ConnectWordPressInput
): Promise<{
  success: boolean;
  error?: string;
  integration_id?: string;
  shared_secret?: string;
  mu_plugin_installed?: boolean;
  wp_user?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Generate shared secret
  const sharedSecret = input.shared_secret || randomBytes(32).toString("hex");

  // Get website to find client_id
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id")
    .eq("id", input.website_id)
    .single();

  if (!website) return { success: false, error: "Website not found" };

  // Test connection first
  const testClient = new WPClient({
    id: "",
    integration_id: "",
    site_url: input.site_url,
    username: input.username,
    app_password: input.app_password,
    shared_secret: sharedSecret,
    ssh_port: input.ssh_port || 22,
    mu_plugin_installed: false,
  });

  const connectionTest = await testClient.testConnection();
  if (!connectionTest.success) {
    return {
      success: false,
      error: `Connection failed: ${connectionTest.error || "Could not reach WordPress REST API"}`,
    };
  }

  // Create integration record
  const { data: integrationData, error: intError } = await supabase
    .from("integrations")
    .insert({
      client_id: website.client_id,
      type: "wordpress" as const,
      account_id: input.site_url.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      account_name: input.username,
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      metadata: {
        site_url: input.site_url.replace(/\/+$/, ""),
        wp_user_id: connectionTest.user?.id,
        wp_user_name: connectionTest.user?.name,
        connected_at: new Date().toISOString(),
      },
      is_active: true,
    })
    .select()
    .single();

  const integration = integrationData as Integration | null;

  if (intError || !integration) {
    return { success: false, error: `Failed to create integration: ${intError?.message}` };
  }

  // Store encrypted credentials
  const encrypted = encryptCredentials({
    username: input.username,
    app_password: input.app_password,
    shared_secret: sharedSecret,
    ssh_host: input.ssh_host,
    ssh_user: input.ssh_user,
    ssh_key: input.ssh_key,
  });

  const { error: credError } = await supabase.from("wordpress_credentials").insert({
    integration_id: integration.id,
    site_url: input.site_url.replace(/\/+$/, ""),
    ...encrypted,
    ssh_port: input.ssh_port || 22,
  });

  if (credError) {
    // Rollback integration
    await supabase.from("integrations").delete().eq("id", integration.id);
    return { success: false, error: `Failed to store credentials: ${credError.message}` };
  }

  // Check if mu-plugin is installed
  const muPluginCheck = await testClient.checkMuPlugin();
  if (muPluginCheck.installed) {
    await supabase
      .from("wordpress_credentials")
      .update({
        mu_plugin_installed: true,
        mu_plugin_version: muPluginCheck.version,
      })
      .eq("integration_id", integration.id);
  }

  // Log activity
  await logActivity({
    clientId: website.client_id,
    actionType: ActivityTypes.WORDPRESS_CONNECTED,
    description: `WordPress connected: ${input.site_url}`,
    metadata: {
      website_id: input.website_id,
      mu_plugin_installed: muPluginCheck.installed,
      wp_user: connectionTest.user?.name,
    },
  });

  revalidatePath(`/admin/websites/${input.website_id}`);
  revalidatePath(`/admin/clients/${website.client_id}`);

  return {
    success: true,
    integration_id: integration.id,
    shared_secret: sharedSecret,
    mu_plugin_installed: muPluginCheck.installed,
    wp_user: connectionTest.user?.name,
  };
}

// ---------------------------------------------------------------------------
// Disconnect WordPress — removes integration + credentials (CASCADE)
// ---------------------------------------------------------------------------

export async function disconnectWordPress(
  websiteId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Get website to find client_id
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id")
    .eq("id", websiteId)
    .single();

  if (!website) return { success: false, error: "Website not found" };

  // Find the WordPress integration
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("client_id", website.client_id)
    .eq("type", "wordpress")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!integration) return { success: false, error: "WordPress integration not found" };

  // Delete integration — credentials cascade
  const { error } = await supabase.from("integrations").delete().eq("id", integration.id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    clientId: website.client_id,
    actionType: ActivityTypes.WORDPRESS_DISCONNECTED,
    description: `WordPress disconnected for website ${websiteId}`,
    metadata: { website_id: websiteId },
  });

  revalidatePath(`/admin/websites/${websiteId}`);
  revalidatePath(`/admin/clients/${website.client_id}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Test existing connection
// ---------------------------------------------------------------------------

export async function testExistingConnection(
  websiteId: string
): Promise<{ success: boolean; error?: string; userName?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const result = await client.testConnection();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, userName: result.user?.name };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Check mu-plugin status
// ---------------------------------------------------------------------------

export async function checkMuPluginStatus(
  websiteId: string
): Promise<{ success: boolean; installed: boolean; version?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, installed: false, error: auth.error };

  try {
    const client = await WPClient.fromWebsiteId(websiteId);
    const result = await client.checkMuPlugin();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, installed: false, error: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Get WordPress connection status for a website
// ---------------------------------------------------------------------------

export async function getWordPressStatus(websiteId: string): Promise<{
  connected: boolean;
  integration_id?: string;
  site_url?: string;
  username?: string;
  mu_plugin_installed?: boolean;
  mu_plugin_version?: string;
  last_health_check?: string;
  connected_at?: string;
}> {
  const supabase = await createClient();

  // Get website to find client_id
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id")
    .eq("id", websiteId)
    .single();

  if (!website) return { connected: false };

  const { data: integrationData } = await supabase
    .from("integrations")
    .select("id, account_name, metadata")
    .eq("client_id", website.client_id)
    .eq("type", "wordpress")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!integrationData) return { connected: false };

  const wpIntegration = integrationData as { id: string; account_name: string | null; metadata: Record<string, unknown> };

  const { data: creds } = await supabase
    .from("wordpress_credentials")
    .select("site_url, mu_plugin_installed, mu_plugin_version, last_health_check")
    .eq("integration_id", wpIntegration.id)
    .single();

  if (!creds) return { connected: false };

  const typedCreds = creds as Pick<
    WordPressCredentialsEncrypted,
    "site_url" | "mu_plugin_installed" | "mu_plugin_version" | "last_health_check"
  >;

  const metadata = wpIntegration.metadata;

  return {
    connected: true,
    integration_id: wpIntegration.id,
    site_url: typedCreds.site_url,
    username: wpIntegration.account_name ?? undefined,
    mu_plugin_installed: typedCreds.mu_plugin_installed,
    mu_plugin_version: typedCreds.mu_plugin_version ?? undefined,
    last_health_check: typedCreds.last_health_check ?? undefined,
    connected_at: (metadata?.connected_at as string) ?? undefined,
  };
}
