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

// ─── Diagnostic Types ─────────────────────────────────────────────────

export type DiagnosticStepName =
  | "site_reachable"
  | "rest_api_available"
  | "authentication"
  | "admin_role"
  | "mu_plugin";

export type DiagnosticStep = {
  step: DiagnosticStepName;
  status: "pass" | "fail" | "warn";
  message: string;
  detail?: string;
};

export type ConnectionDiagnostics = {
  overall: "pass" | "fail" | "warn";
  steps: DiagnosticStep[];
  duration_ms: number;
  timestamp: string;
};

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
      "X-WP-Auth": this.authHeader, // Fallback for hosts that strip Authorization header
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

  // ─── Detailed Connection Diagnostics ────────────────────────────────

  async diagnoseConnection(): Promise<ConnectionDiagnostics> {
    const steps: DiagnosticStep[] = [];
    const startTime = Date.now();

    // Step 1: DNS / Reachability — hit the site root
    try {
      const rootResp = await fetch(this.siteUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      steps.push({
        step: "site_reachable",
        status: "pass",
        message: `Site responded with HTTP ${rootResp.status}`,
        detail: `URL: ${this.siteUrl}`,
      });
    } catch (err) {
      const msg = (err as Error).message;
      let detail = msg;
      if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
        detail = "DNS lookup failed — the domain does not resolve. Check the Site URL.";
      } else if (msg.includes("ECONNREFUSED")) {
        detail = "Connection refused — the server is not accepting connections on this port.";
      } else if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
        detail = "Connection timed out — the server did not respond within 10 seconds.";
      } else if (msg.includes("CERT") || msg.includes("SSL") || msg.includes("certificate")) {
        detail = "SSL/TLS error — the site has an invalid or expired certificate.";
      }
      steps.push({ step: "site_reachable", status: "fail", message: "Cannot reach site", detail });
      return this.buildDiagnostics(steps, startTime);
    }

    // Step 2: REST API availability — hit /wp-json/
    let restApiAvailable = false;
    let serverSoftware = "";
    try {
      const restResp = await fetch(`${this.siteUrl}/wp-json/`, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      });
      const contentType = restResp.headers.get("content-type") || "";
      serverSoftware = restResp.headers.get("server") || "";

      if (restResp.ok && contentType.includes("json")) {
        steps.push({
          step: "rest_api_available",
          status: "pass",
          message: `WordPress REST API is accessible (Server: ${serverSoftware || "unknown"})`,
        });
        restApiAvailable = true;
      } else if (restResp.status === 404) {
        steps.push({
          step: "rest_api_available",
          status: "fail",
          message: "REST API not found (404)",
          detail:
            "The WordPress REST API is not accessible at /wp-json/. " +
            "Possible causes:\n" +
            "- Pretty permalinks are not enabled (Settings → Permalinks → choose anything except 'Plain')\n" +
            "- A security plugin is blocking the REST API\n" +
            "- The site is not WordPress",
        });
      } else if (restResp.status === 403) {
        steps.push({
          step: "rest_api_available",
          status: "fail",
          message: "REST API blocked (403 Forbidden)",
          detail:
            "The server returned 403 for /wp-json/. " +
            "This is usually caused by:\n" +
            "- A security plugin (Wordfence, iThemes, etc.) blocking REST API access\n" +
            "- Server-level rules (.htaccess or Nginx config) blocking /wp-json/\n" +
            "- ModSecurity or a WAF blocking the request",
        });
      } else if (!contentType.includes("json")) {
        const bodySnippet = await restResp.text().catch(() => "");
        const isHtml = contentType.includes("html") || bodySnippet.trim().startsWith("<");
        steps.push({
          step: "rest_api_available",
          status: "fail",
          message: `REST API returned non-JSON response (${restResp.status})`,
          detail: isHtml
            ? "The server returned HTML instead of JSON. This could mean:\n" +
              "- The site is in maintenance mode\n" +
              "- A redirect is happening (check Site URL)\n" +
              "- A security plugin is injecting a login/challenge page"
            : `Content-Type: ${contentType}`,
        });
      } else {
        steps.push({
          step: "rest_api_available",
          status: "warn",
          message: `REST API responded with HTTP ${restResp.status}`,
        });
        restApiAvailable = true;
      }
    } catch (err) {
      steps.push({
        step: "rest_api_available",
        status: "fail",
        message: "Failed to reach REST API",
        detail: (err as Error).message,
      });
    }

    if (!restApiAvailable) {
      return this.buildDiagnostics(steps, startTime);
    }

    // Step 3: Authentication — /wp-json/wp/v2/users/me
    let authenticated = false;
    try {
      const authResp = await fetch(`${this.siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
        headers: {
          Authorization: this.authHeader,
          "X-WP-Auth": this.authHeader,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });

      if (authResp.ok) {
        const user = (await authResp.json()) as WPUser;
        steps.push({
          step: "authentication",
          status: "pass",
          message: `Authenticated as "${user.name}" (ID: ${user.id})`,
          detail: `Roles: ${(user as WPUser & { roles?: string[] }).roles?.join(", ") || "unknown"}`,
        });
        authenticated = true;

        // Check if user has admin capabilities
        const caps = (user as WPUser & { capabilities?: Record<string, boolean> }).capabilities;
        if (caps && !caps["manage_options"]) {
          steps.push({
            step: "admin_role",
            status: "fail",
            message: "User does not have Administrator role",
            detail:
              `The user "${user.name}" is authenticated but lacks the manage_options capability. ` +
              "The WordPress user must have the Administrator role for the dashboard connector to work.",
          });
        } else if (caps && caps["manage_options"]) {
          steps.push({
            step: "admin_role",
            status: "pass",
            message: "User has Administrator privileges",
          });
        }
      } else {
        const errorBody = await authResp.text().catch(() => "");
        let parsed: { code?: string; message?: string } = {};
        try {
          parsed = JSON.parse(errorBody);
        } catch {
          // not JSON
        }

        const code = parsed.code || "";
        const wpMsg = parsed.message || "";

        if (authResp.status === 401) {
          if (code === "rest_not_logged_in") {
            const isApache = /apache/i.test(serverSoftware);
            const isLiteSpeed = /litespeed/i.test(serverSoftware);
            const isNginx = /nginx/i.test(serverSoftware);
            const serverNote = serverSoftware
              ? `Detected server: ${serverSoftware}`
              : "Could not detect server software";

            let detail =
              `${serverNote}\n\n` +
              "WordPress received the request but did not see any credentials. " +
              "The Authorization header is being stripped before PHP can read it.\n\n";

            if (isApache || isLiteSpeed) {
              detail +=
                `This is a known issue with ${isApache ? "Apache" : "LiteSpeed"} hosting.\n\n` +
                "THE FIX — do ONE of these (try in order):\n\n" +
                "Option A: Install the mu-plugin FIRST (recommended)\n" +
                "  1. Download dashboard-connector.php from the button below\n" +
                "  2. Upload it to: wp-content/mu-plugins/dashboard-connector.php\n" +
                "     (create the mu-plugins folder if it doesn't exist)\n" +
                "  3. Then click 'Connect & Save' again — the mu-plugin has a\n" +
                "     built-in workaround that reads the X-WP-Auth fallback header\n\n" +
                "Option B: Fix .htaccess\n" +
                "  Add this line to .htaccess BEFORE the WordPress rules:\n" +
                "  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n\n" +
                "Option C: Fix wp-config.php (for CGI/FastCGI)\n" +
                "  Add this line near the top of wp-config.php:\n" +
                "  $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';";
            } else if (isNginx) {
              detail +=
                "This is unusual for Nginx — it typically passes auth headers.\n\n" +
                "Possible causes:\n" +
                "- A reverse proxy in front of Nginx is stripping headers\n" +
                "- fastcgi_pass_header is not configured\n" +
                "- A security plugin is blocking Application Passwords\n\n" +
                "THE FIX:\n" +
                "1. Install the mu-plugin (dashboard-connector.php) — it has a\n" +
                "   built-in workaround using the X-WP-Auth fallback header\n" +
                "2. Or add to your Nginx config (in the PHP location block):\n" +
                "   fastcgi_pass_header Authorization;";
            } else {
              detail +=
                "THE FIX — install the mu-plugin FIRST:\n" +
                "  1. Download dashboard-connector.php from the button below\n" +
                "  2. Upload it to: wp-content/mu-plugins/dashboard-connector.php\n" +
                "  3. Then click 'Connect & Save' again\n\n" +
                "The mu-plugin restores credentials from a fallback header (X-WP-Auth)\n" +
                "that bypasses the server's header stripping.";
            }

            steps.push({
              step: "authentication",
              status: "fail",
              message: `401 — Authorization header stripped by server (${serverSoftware || "unknown"})`,
              detail,
            });
          } else if (code === "invalid_application_password" || code === "incorrect_password") {
            steps.push({
              step: "authentication",
              status: "fail",
              message: "401 — Invalid Application Password",
              detail:
                "The username was found but the Application Password is wrong.\n\n" +
                "Fixes:\n" +
                "- Go to WordPress Admin → Users → Profile → Application Passwords\n" +
                "- Revoke the old password and generate a new one\n" +
                "- Copy it exactly (including spaces between groups)\n" +
                "- Paste it in the dashboard connection form",
            });
          } else if (code === "invalid_username") {
            steps.push({
              step: "authentication",
              status: "fail",
              message: "401 — Username not found",
              detail:
                `WordPress does not have a user named "${this.getUsername()}". ` +
                "Use the WordPress username (not email). Check in WP Admin → Users.",
            });
          } else {
            steps.push({
              step: "authentication",
              status: "fail",
              message: `401 — Authentication failed (${code || "unknown code"})`,
              detail: wpMsg || errorBody.slice(0, 500),
            });
          }
        } else if (authResp.status === 403) {
          steps.push({
            step: "authentication",
            status: "fail",
            message: "403 — Forbidden",
            detail:
              wpMsg ||
              "Access denied. A security plugin may be blocking Application Password authentication " +
              "or the REST API /users/me endpoint.",
          });
        } else if (authResp.status === 404) {
          steps.push({
            step: "authentication",
            status: "fail",
            message: "404 — /wp/v2/users/me not found",
            detail: "The users endpoint is missing. The REST API may be partially disabled by a plugin.",
          });
        } else {
          steps.push({
            step: "authentication",
            status: "fail",
            message: `HTTP ${authResp.status} — ${wpMsg || authResp.statusText}`,
            detail: errorBody.slice(0, 500),
          });
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      steps.push({
        step: "authentication",
        status: "fail",
        message: "Authentication request failed",
        detail: msg.includes("timeout")
          ? "The authentication request timed out (15s). The server may be overloaded."
          : msg,
      });
    }

    if (!authenticated) {
      return this.buildDiagnostics(steps, startTime);
    }

    // Step 4: mu-plugin / shared secret — /wp-json/dashboard/v1/site-health
    try {
      const muResp = await fetch(`${this.siteUrl}/wp-json/dashboard/v1/site-health`, {
        headers: {
          Authorization: this.authHeader,
          "X-WP-Auth": this.authHeader,
          "Content-Type": "application/json",
          "X-Dashboard-Secret": this.secretHeader,
        },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });

      if (muResp.ok) {
        const health = (await muResp.json()) as SiteHealthData & { connector_version?: string };
        steps.push({
          step: "mu_plugin",
          status: "pass",
          message: `mu-plugin active (v${health.connector_version || "unknown"})`,
          detail: `WP ${health.wp_version}, PHP ${health.php_version}`,
        });
      } else {
        const errorBody = await muResp.text().catch(() => "");
        let parsed: { code?: string; message?: string } = {};
        try {
          parsed = JSON.parse(errorBody);
        } catch {
          // not JSON
        }

        const code = parsed.code || "";
        const wpMsg = parsed.message || "";

        if (muResp.status === 404) {
          steps.push({
            step: "mu_plugin",
            status: "warn",
            message: "mu-plugin not installed (404 on /dashboard/v1/)",
            detail:
              "The dashboard connector mu-plugin is not installed. " +
              "Without it, advanced features (debug logs, site health, cache clearing) won't work.\n\n" +
              "Install it:\n" +
              "1. Download dashboard-connector.php from the dashboard\n" +
              "2. Upload it to wp-content/mu-plugins/dashboard-connector.php\n" +
              "3. Or use the 'Deploy via SSH' button if SSH is configured",
          });
        } else if (muResp.status === 403 && code === "rest_forbidden" && wpMsg.includes("secret")) {
          steps.push({
            step: "mu_plugin",
            status: "fail",
            message: "Shared secret mismatch",
            detail:
              "The mu-plugin is installed but the shared secret doesn't match.\n\n" +
              "The secret sent by the dashboard does not match DASHBOARD_SHARED_SECRET in wp-config.php.\n" +
              "Fix: Check that wp-config.php has the correct define():\n" +
              "  define('DASHBOARD_SHARED_SECRET', 'your-secret-here');",
          });
        } else if (muResp.status === 500 && code === "rest_config_error") {
          steps.push({
            step: "mu_plugin",
            status: "fail",
            message: "DASHBOARD_SHARED_SECRET not configured in wp-config.php",
            detail:
              "The mu-plugin is installed but DASHBOARD_SHARED_SECRET is not defined.\n\n" +
              "Add this line to wp-config.php (before 'That's all, stop editing!'):\n" +
              "  define('DASHBOARD_SHARED_SECRET', 'your-secret-here');",
          });
        } else if (muResp.status === 401) {
          steps.push({
            step: "mu_plugin",
            status: "fail",
            message: "mu-plugin returned 401 — authentication lost on custom endpoint",
            detail:
              "Basic auth worked for /wp/v2/ but failed for /dashboard/v1/. " +
              "This can happen if:\n" +
              "- The mu-plugin file is corrupted or incomplete\n" +
              "- A caching layer is stripping auth headers on custom endpoints\n" +
              "- A security plugin interferes with custom REST routes",
          });
        } else {
          steps.push({
            step: "mu_plugin",
            status: "fail",
            message: `mu-plugin error: HTTP ${muResp.status}`,
            detail: wpMsg || errorBody.slice(0, 500),
          });
        }
      }
    } catch (err) {
      steps.push({
        step: "mu_plugin",
        status: "warn",
        message: "Could not check mu-plugin",
        detail: (err as Error).message,
      });
    }

    return this.buildDiagnostics(steps, startTime);
  }

  private buildDiagnostics(steps: DiagnosticStep[], startTime: number): ConnectionDiagnostics {
    const hasFailure = steps.some((s) => s.status === "fail");
    const hasWarning = steps.some((s) => s.status === "warn");
    return {
      overall: hasFailure ? "fail" : hasWarning ? "warn" : "pass",
      steps,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private getUsername(): string {
    // Decode username from the Basic auth header
    try {
      const b64 = this.authHeader.replace("Basic ", "");
      const decoded = Buffer.from(b64, "base64").toString();
      return decoded.split(":")[0] || "unknown";
    } catch {
      return "unknown";
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
