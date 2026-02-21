/**
 * WordPress REST API client — class-based with shared secret support.
 * Authenticates via Application Password + X-Dashboard-Secret header.
 */

import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/google";
import type {
  WordPressCredentials,
  WordPressCredentialsEncrypted,
  SiteHealthData,
  PluginInfo,
  DebugLogResponse,
  WPUser,
  WPMediaItem,
  WPPost,
  WPPage,
} from "@/types/wordpress";

export class WPClient {
  private siteUrl: string;
  private authHeader: string;
  private secretHeader: string;
  private integrationId: string;

  constructor(credentials: WordPressCredentials) {
    this.siteUrl = credentials.site_url.replace(/\/+$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${credentials.username}:${credentials.app_password}`).toString("base64");
    this.secretHeader = credentials.shared_secret;
    this.integrationId = credentials.integration_id;
  }

  // ─── Factory ───────────────────────────────────────────────────────

  static async fromWebsiteId(websiteId: string): Promise<WPClient> {
    const supabase = await createClient();

    // Find WordPress integration for this website's client
    const { data: website } = await supabase
      .from("websites")
      .select("id, client_id")
      .eq("id", websiteId)
      .single();

    if (!website) throw new Error("Website not found");

    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("client_id", website.client_id)
      .eq("type", "wordpress")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!integration) throw new Error("WordPress integration not found");

    const { data: creds } = await supabase
      .from("wordpress_credentials")
      .select("*")
      .eq("integration_id", integration.id)
      .single();

    if (!creds) throw new Error("WordPress credentials not found");

    return new WPClient(decryptCredentials(creds as WordPressCredentialsEncrypted));
  }

  get integrationIdValue(): string {
    return this.integrationId;
  }

  // ─── Core Request Method ───────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: Record<string, unknown>;
      isCustomEndpoint?: boolean;
      confirmAction?: boolean;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const {
      method = "GET",
      body,
      isCustomEndpoint = false,
      confirmAction = false,
      params,
    } = options;

    const base = isCustomEndpoint
      ? `${this.siteUrl}/wp-json/dashboard/v1`
      : `${this.siteUrl}/wp-json/wp/v2`;

    let url = `${base}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      "X-Dashboard-Secret": this.secretHeader,
    };

    if (confirmAction) {
      headers["X-Dashboard-Action"] = "confirm";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(
        `WP API Error (${response.status}): ${(error as { message?: string }).message || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  // ─── Connection Test ───────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; user?: WPUser; error?: string }> {
    try {
      const user = await this.request<WPUser>("/users/me", {
        params: { context: "edit" },
      });
      return { success: true, user };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ─── mu-plugin Check ──────────────────────────────────────────────

  async checkMuPlugin(): Promise<{ installed: boolean; version?: string }> {
    try {
      const health = await this.request<SiteHealthData & { connector_version?: string }>(
        "/site-health",
        { isCustomEndpoint: true }
      );
      return { installed: true, version: health.connector_version };
    } catch {
      return { installed: false };
    }
  }

  // ─── Custom Endpoints (mu-plugin required) ─────────────────────────

  async getDebugLog(lines: number = 200): Promise<DebugLogResponse> {
    return this.request("/debug-log", {
      isCustomEndpoint: true,
      params: { lines: String(lines) },
    });
  }

  async getSiteHealth(): Promise<SiteHealthData> {
    return this.request("/site-health", { isCustomEndpoint: true });
  }

  async getPlugins(): Promise<PluginInfo[]> {
    return this.request("/plugins", { isCustomEndpoint: true });
  }

  async togglePlugin(
    plugin: string,
    activate: boolean
  ): Promise<{ success: boolean; status: string }> {
    return this.request("/plugins/toggle", {
      isCustomEndpoint: true,
      method: "POST",
      body: { plugin, activate },
      confirmAction: true,
    });
  }

  async clearCache(): Promise<{ success: boolean; cleared: string[] }> {
    return this.request("/cache/clear", {
      isCustomEndpoint: true,
      method: "POST",
      confirmAction: true,
    });
  }

  async toggleMaintenance(
    enable: boolean
  ): Promise<{ success: boolean; maintenance: boolean }> {
    return this.request("/maintenance", {
      isCustomEndpoint: true,
      method: "POST",
      body: { enable },
      confirmAction: true,
    });
  }

  async toggleDebugMode(
    enable: boolean
  ): Promise<{ success: boolean; debug: boolean }> {
    return this.request("/debug-mode", {
      isCustomEndpoint: true,
      method: "POST",
      body: { enable },
      confirmAction: true,
    });
  }

  // ─── Standard WP REST API ─────────────────────────────────────────

  async getMedia(params?: {
    per_page?: number;
    page?: number;
    search?: string;
  }): Promise<WPMediaItem[]> {
    return this.request("/media", {
      params: {
        per_page: String(params?.per_page || 100),
        page: String(params?.page || 1),
        ...(params?.search && { search: params.search }),
      },
    });
  }

  async getMediaItem(id: number): Promise<WPMediaItem> {
    return this.request(`/media/${id}`);
  }

  async updateMediaItem(
    id: number,
    data: { alt_text?: string; title?: string; caption?: string; description?: string }
  ): Promise<WPMediaItem> {
    return this.request(`/media/${id}`, { method: "POST", body: data as Record<string, unknown> });
  }

  async getPages(params?: {
    per_page?: number;
    page?: number;
    search?: string;
    status?: string;
  }): Promise<WPPage[]> {
    return this.request("/pages", {
      params: {
        per_page: String(params?.per_page || 100),
        page: String(params?.page || 1),
        status: params?.status || "publish",
        ...(params?.search && { search: params.search }),
      },
    });
  }

  async getPage(id: number): Promise<WPPage> {
    return this.request(`/pages/${id}`, { params: { context: "edit" } });
  }

  async updatePage(id: number, data: Partial<WPPage>): Promise<WPPage> {
    return this.request(`/pages/${id}`, {
      method: "POST",
      body: data as Record<string, unknown>,
    });
  }

  async getPosts(params?: {
    per_page?: number;
    page?: number;
    search?: string;
    status?: string;
  }): Promise<WPPost[]> {
    return this.request("/posts", {
      params: {
        per_page: String(params?.per_page || 100),
        page: String(params?.page || 1),
        status: params?.status || "publish",
        ...(params?.search && { search: params.search }),
      },
    });
  }

  async getPost(id: number): Promise<WPPost> {
    return this.request(`/posts/${id}`, { params: { context: "edit" } });
  }

  async updatePost(id: number, data: Partial<WPPost>): Promise<WPPost> {
    return this.request(`/posts/${id}`, {
      method: "POST",
      body: data as Record<string, unknown>,
    });
  }

  async getMenus(): Promise<unknown[]> {
    return this.request("/menus", { params: { context: "edit" } });
  }

  async getMenuItems(menuId: number): Promise<unknown[]> {
    return this.request("/menu-items", {
      params: { menus: String(menuId), per_page: "100" },
    });
  }

  async createMenuItem(data: {
    title: string;
    url?: string;
    menus: number;
    parent?: number;
    object_id?: number;
    object?: string;
    type?: string;
  }): Promise<unknown> {
    return this.request("/menu-items", {
      method: "POST",
      body: { ...data, status: "publish" } as Record<string, unknown>,
    });
  }

  async updateMenuItem(id: number, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/menu-items/${id}`, { method: "POST", body: data });
  }

  async deleteMenuItem(id: number): Promise<unknown> {
    return this.request(`/menu-items/${id}`, {
      method: "DELETE",
      params: { force: "true" },
    });
  }
}

// ─── Encryption Helpers ──────────────────────────────────────────────

export function encryptCredentials(creds: {
  username: string;
  app_password: string;
  shared_secret: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_key?: string;
}): {
  username_encrypted: string;
  app_password_encrypted: string;
  shared_secret_encrypted: string;
  ssh_host_encrypted?: string;
  ssh_user_encrypted?: string;
  ssh_key_encrypted?: string;
} {
  return {
    username_encrypted: encryptToken(creds.username),
    app_password_encrypted: encryptToken(creds.app_password),
    shared_secret_encrypted: encryptToken(creds.shared_secret),
    ...(creds.ssh_host && { ssh_host_encrypted: encryptToken(creds.ssh_host) }),
    ...(creds.ssh_user && { ssh_user_encrypted: encryptToken(creds.ssh_user) }),
    ...(creds.ssh_key && { ssh_key_encrypted: encryptToken(creds.ssh_key) }),
  };
}

export function decryptCredentials(
  creds: WordPressCredentialsEncrypted
): WordPressCredentials {
  return {
    id: creds.id,
    integration_id: creds.integration_id,
    site_url: creds.site_url,
    username: decryptToken(creds.username_encrypted),
    app_password: decryptToken(creds.app_password_encrypted),
    shared_secret: decryptToken(creds.shared_secret_encrypted),
    ...(creds.ssh_host_encrypted && { ssh_host: decryptToken(creds.ssh_host_encrypted) }),
    ...(creds.ssh_user_encrypted && { ssh_user: decryptToken(creds.ssh_user_encrypted) }),
    ...(creds.ssh_key_encrypted && { ssh_key: decryptToken(creds.ssh_key_encrypted) }),
    ssh_port: creds.ssh_port,
    mu_plugin_installed: creds.mu_plugin_installed,
    mu_plugin_version: creds.mu_plugin_version ?? undefined,
    last_health_check: creds.last_health_check ?? undefined,
    last_health_status: creds.last_health_status ?? undefined,
  };
}
