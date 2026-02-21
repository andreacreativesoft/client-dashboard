/**
 * WordPress REST API client for remote site management.
 * Authenticates via WordPress Application Passwords.
 */

export type WPApiCredentials = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

export type WPApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
};

export type WPDebugLogResponse = {
  lines: string[];
  file_size: number;
  debug_enabled: boolean;
  log_enabled: boolean;
  last_modified: string;
};

export type WPSiteHealthResponse = {
  wordpress_version: string;
  php_version: string;
  server_software: string;
  mysql_version: string;
  theme: { name: string; version: string; template: string };
  plugins: {
    name: string;
    slug: string;
    version: string;
    active: boolean;
    update_available: string | null;
  }[];
  disk_usage: string;
  db_size: string;
  autoload_size: string;
  debug_mode: boolean;
  memory_limit: string;
  max_execution_time: number;
  upload_max_filesize: string;
};

function buildAuthHeader(username: string, appPassword: string): string {
  const encoded = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${encoded}`;
}

function normalizeUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

/**
 * Parse a WordPress REST API error response and return a user-friendly message.
 */
function parseWPError(status: number, body: string, serverHeader?: string): string {
  // Non-JSON response — likely HTML redirect, WAF, or maintenance page
  let json: { code?: string; message?: string; data?: { status?: number } } | null = null;
  try {
    json = JSON.parse(body);
  } catch {
    // Not JSON
  }

  if (!json) {
    const isHtml = body.trim().startsWith("<");
    if (status === 401 && isHtml) {
      return (
        "Authentication failed — the server returned HTML instead of JSON.\n" +
        "This usually means a security plugin or WAF is intercepting the request before WordPress can process it."
      );
    }
    if (status === 403 && isHtml) {
      return (
        "Access blocked (403) — the server returned HTML.\n" +
        "A firewall, ModSecurity, or security plugin is blocking REST API requests."
      );
    }
    if (status === 503) {
      return "Site unavailable (503) — the site may be in maintenance mode or the server is overloaded.";
    }
    if (status === 502 || status === 504) {
      return `Gateway error (${status}) — the web server could not reach PHP. Check that PHP-FPM is running.`;
    }
    return `HTTP ${status}: Server returned non-JSON response. ${isHtml ? "Got HTML — possible redirect or WAF block." : body.slice(0, 200)}`;
  }

  const code = json.code || "";
  const wpMsg = json.message || "";

  // 401 errors
  if (status === 401) {
    if (code === "rest_not_logged_in") {
      const server = (serverHeader || "").toLowerCase();
      const isApache = server.includes("apache");
      const isLiteSpeed = server.includes("litespeed");
      const isNginx = server.includes("nginx");
      const serverName = serverHeader || "unknown";

      let msg = `Authentication failed — Authorization header stripped by server (${serverName}).\n\n`;
      msg += "WordPress received the request but did not see any credentials.\n";
      msg += "The web server is stripping the Authorization header before PHP can read it.\n\n";

      if (isApache || isLiteSpeed) {
        msg +=
          `This is a known issue with ${isApache ? "Apache" : "LiteSpeed"} hosting.\n\n` +
          "THE FIX — do ONE of these:\n\n" +
          "1. Install the mu-plugin FIRST (recommended)\n" +
          "   Download dashboard-connector.php (button above) and upload it to:\n" +
          "   wp-content/mu-plugins/dashboard-connector.php\n" +
          "   (create the mu-plugins folder if it doesn't exist)\n" +
          "   Then click 'Test Connection' again.\n\n" +
          "2. Add to .htaccess (BEFORE the WordPress rules):\n" +
          "   RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n\n" +
          "3. For CGI/FastCGI, add to wp-config.php:\n" +
          "   $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';";
      } else if (isNginx) {
        msg +=
          "This is unusual for Nginx — it typically passes auth headers.\n\n" +
          "Possible causes:\n" +
          "- A reverse proxy is stripping headers\n" +
          "- fastcgi_pass_header not configured\n" +
          "- A security plugin is blocking Application Passwords\n\n" +
          "THE FIX:\n" +
          "1. Install the mu-plugin (download above) — it has a built-in workaround\n" +
          "2. Or add to your Nginx config (in the PHP location block):\n" +
          "   fastcgi_pass_header Authorization;";
      } else {
        msg +=
          "THE FIX:\n" +
          "1. Download and install the mu-plugin (button above) — it has a built-in\n" +
          "   workaround that bypasses the server's header stripping.\n" +
          "   Upload it to: wp-content/mu-plugins/dashboard-connector.php\n" +
          "   Then try connecting again.";
      }

      return msg;
    }
    if (code === "invalid_application_password" || code === "incorrect_password") {
      return (
        "Invalid Application Password.\n\n" +
        "The username was found but the password is wrong. To fix:\n" +
        "1. Go to WordPress Admin → Users → Profile → Application Passwords\n" +
        "2. Revoke the old password and generate a new one\n" +
        "3. Copy it exactly (spaces between groups are fine)\n" +
        "4. Paste it in the dashboard connection form"
      );
    }
    if (code === "invalid_username") {
      return (
        "WordPress username not found.\n\n" +
        "Use the WordPress username (not email address). " +
        "Check the correct username in WP Admin → Users."
      );
    }
    return `Authentication failed (${code}): ${wpMsg}`;
  }

  // 403 errors
  if (status === 403) {
    if (code === "rest_forbidden" && wpMsg.toLowerCase().includes("secret")) {
      return (
        "Shared secret mismatch — the mu-plugin rejected the dashboard secret.\n\n" +
        "Check that DASHBOARD_SHARED_SECRET in wp-config.php matches the secret stored in the dashboard."
      );
    }
    if (code === "rest_forbidden") {
      return (
        "Access denied (403) — insufficient permissions.\n\n" +
        wpMsg +
        "\n\nThe WordPress user must have the Administrator role."
      );
    }
    return `Forbidden (${code}): ${wpMsg}`;
  }

  // 404 errors
  if (status === 404) {
    if (code === "rest_no_route") {
      return (
        "REST API route not found (404).\n\n" +
        "The endpoint does not exist. If this is a /dashboard/v1/ endpoint, " +
        "the mu-plugin (dashboard-connector.php) is not installed."
      );
    }
    return `Not found (404): ${wpMsg || "The requested endpoint does not exist."}`;
  }

  // 429 rate limit
  if (status === 429) {
    return "Rate limited (429) — too many requests. Wait a minute and try again.";
  }

  // 500 server errors
  if (status === 500) {
    if (code === "rest_config_error") {
      return (
        "Configuration error on WordPress side.\n\n" +
        wpMsg +
        "\n\nThis usually means DASHBOARD_SHARED_SECRET is not defined in wp-config.php."
      );
    }
    return `WordPress server error (500): ${wpMsg || "Internal server error. Check the WordPress debug log."}`;
  }

  // Fallback: use the WP message if available
  if (wpMsg) {
    return `WordPress error: ${wpMsg} (${code || status})`;
  }

  return `HTTP ${status}: ${body.slice(0, 200)}`;
}

export async function wpApiFetch<T>(
  credentials: WPApiCredentials,
  endpoint: string,
  options: RequestInit = {}
): Promise<WPApiResponse<T>> {
  const baseUrl = normalizeUrl(credentials.siteUrl);
  const url = `${baseUrl}${endpoint}`;
  const authHeader = buildAuthHeader(credentials.username, credentials.appPassword);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: authHeader,
        "X-Dashboard-Token": authHeader, // Fallback for hosts that strip Authorization (avoids "Auth" in name for LiteSpeed)
        "X-WP-Auth": authHeader, // Legacy fallback
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      const serverHeader = response.headers.get("server") || undefined;
      return {
        success: false,
        error: parseWPError(response.status, errorText, serverHeader),
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    let error = msg;

    if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
      error = `DNS lookup failed — cannot resolve hostname. Check the Site URL is correct.\n\nOriginal error: ${msg}`;
    } else if (msg.includes("ECONNREFUSED")) {
      error = `Connection refused — the server is not accepting connections.\n\nOriginal error: ${msg}`;
    } else if (msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("TimeoutError")) {
      error = `Connection timed out — the server did not respond within 30 seconds.\n\nOriginal error: ${msg}`;
    } else if (msg.includes("CERT") || msg.includes("SSL") || msg.includes("certificate")) {
      error = `SSL/TLS error — the site has an invalid or expired certificate.\n\nOriginal error: ${msg}`;
    } else if (msg.includes("ECONNRESET")) {
      error = `Connection reset — the server dropped the connection unexpectedly.\n\nOriginal error: ${msg}`;
    }

    return { success: false, error };
  }
}

/**
 * Test the WordPress connection by calling /wp-json/wp/v2/users/me.
 * On auth failure, probes the mu-plugin's auth-debug endpoint (public, no auth needed)
 * to see exactly which headers the server received.
 */
export async function testWPConnection(
  credentials: WPApiCredentials
): Promise<WPApiResponse<{ id: number; name: string; slug: string }>> {
  const result = await wpApiFetch<{ id: number; name: string; slug: string }>(
    credentials,
    "/wp-json/wp/v2/users/me?context=edit"
  );

  // If auth failed, probe the auth-debug endpoint for more details
  if (!result.success && result.status === 401) {
    const debugInfo = await probeAuthDebug(credentials);
    if (debugInfo) {
      result.error = (result.error || "") + "\n\n" + debugInfo;
    }
  }

  return result;
}

/**
 * Probe the mu-plugin's auth-debug endpoint (public, no auth needed) to see
 * which headers the server actually received. Returns a human-readable summary
 * or null if the endpoint is not available (mu-plugin not installed).
 */
async function probeAuthDebug(credentials: WPApiCredentials): Promise<string | null> {
  const baseUrl = normalizeUrl(credentials.siteUrl);
  const authHeader = buildAuthHeader(credentials.username, credentials.appPassword);

  try {
    const resp = await fetch(`${baseUrl}/wp-json/dashboard/v1/auth-debug`, {
      headers: {
        Authorization: authHeader,
        "X-Dashboard-Token": authHeader,
        "X-WP-Auth": authHeader,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        return "DIAGNOSTIC: mu-plugin not installed — /wp-json/dashboard/v1/auth-debug returned 404.\nUpload dashboard-connector.php to wp-content/mu-plugins/ and retry.";
      }
      return null;
    }

    const data = await resp.json() as {
      auth_method?: string;
      is_logged_in?: boolean;
      headers_received?: Record<string, boolean>;
      checks?: { check: string; status: string; message: string; detail?: string }[];
    };

    const lines: string[] = ["DIAGNOSTIC (from mu-plugin auth-debug):"];

    if (data.auth_method) {
      lines.push(`  Auth method: ${data.auth_method}`);
    }

    lines.push(`  Logged in: ${data.is_logged_in ? "yes" : "no"}`);

    if (data.checks) {
      for (const check of data.checks) {
        const icon = check.status === "pass" ? "OK" : check.status === "fail" ? "FAIL" : "WARN";
        lines.push(`  [${icon}] ${check.message}`);
        if (check.detail && check.status === "fail") {
          lines.push(`       ${check.detail}`);
        }
      }
    }

    return lines.join("\n");
  } catch {
    // auth-debug endpoint not reachable — mu-plugin likely not installed
    return null;
  }
}

/**
 * Fetch debug.log contents via the dashboard-connector mu-plugin.
 */
export async function fetchDebugLog(
  credentials: WPApiCredentials,
  lines: number = 200
): Promise<WPApiResponse<WPDebugLogResponse>> {
  return wpApiFetch(credentials, `/wp-json/dashboard/v1/debug-log?lines=${lines}`);
}

/**
 * Fetch site health info via the dashboard-connector mu-plugin.
 */
export async function fetchSiteHealth(
  credentials: WPApiCredentials
): Promise<WPApiResponse<WPSiteHealthResponse>> {
  return wpApiFetch(credentials, "/wp-json/dashboard/v1/site-health");
}
