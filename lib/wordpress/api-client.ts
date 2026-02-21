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
function parseWPError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as { code?: string; message?: string };
    const code = json.code || "";

    if (code === "rest_not_logged_in" || (status === 401 && body.includes("rest_not_logged_in"))) {
      return (
        "Authentication failed — WordPress is not receiving the credentials. " +
        "This usually means your hosting (Apache) strips the Authorization header. " +
        "Fix: add this line to your .htaccess file (before the WordPress rules):\n" +
        'RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n\n' +
        "Also verify:\n" +
        "- The username exists and has Administrator role\n" +
        "- The Application Password is correct (no extra spaces)\n" +
        "- No security plugin is blocking Application Passwords"
      );
    }

    if (code === "invalid_application_password" || code === "incorrect_password") {
      return "Invalid Application Password. Generate a new one in WordPress: Users → Profile → Application Passwords.";
    }

    if (code === "invalid_username") {
      return "WordPress username not found. Check that you entered the correct username (not email).";
    }

    if (code === "rest_forbidden") {
      return "Access denied — the WordPress user does not have sufficient permissions. An Administrator role is required.";
    }

    // Fallback: use the WP message if available
    if (json.message) {
      return `WordPress error: ${json.message} (${code || status})`;
    }
  } catch {
    // Not JSON — fall through
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

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: buildAuthHeader(credentials.username, credentials.appPassword),
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: parseWPError(response.status, errorText),
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

/**
 * Test the WordPress connection by calling /wp-json/wp/v2/users/me
 */
export async function testWPConnection(
  credentials: WPApiCredentials
): Promise<WPApiResponse<{ id: number; name: string; slug: string }>> {
  return wpApiFetch(credentials, "/wp-json/wp/v2/users/me?context=edit");
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
