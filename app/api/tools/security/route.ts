import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT = 10000;

type SecurityResult = {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string;
  details: string;
  category: "headers" | "wordpress" | "server" | "access";
};

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "ClientDashboard-SecurityAudit/1.0",
        ...options?.headers,
      },
    });
    clearTimeout(timeout);
    return res;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await rateLimit(`tools:security:${ip}`, { windowMs: 60_000, maxRequests: 5 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { websiteId } = body as { websiteId: string };

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  const { data: website } = await supabase
    .from("websites")
    .select("id, url, name, client_id")
    .eq("id", websiteId)
    .single();

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const startTime = Date.now();
  const admin = createAdminClient();

  // Create check record
  const { data: checkRow } = await admin
    .from("site_checks")
    .insert({
      website_id: website.id,
      client_id: website.client_id,
      check_type: "security" as const,
      status: "running" as const,
      score: null,
      summary: {},
      results: [],
      duration_ms: null,
    })
    .select("id")
    .single();

  const checkId = (checkRow as { id: string } | null)?.id;

  if (!checkId) {
    return NextResponse.json({ error: "Failed to create check" }, { status: 500 });
  }

  try {
    const results: SecurityResult[] = [];
    const baseUrl = website.url.replace(/\/$/, "");

    // Fetch homepage
    const mainRes = await fetchWithTimeout(baseUrl);
    if (!mainRes) {
      throw new Error("Could not reach website");
    }
    const html = await mainRes.text();

    // ─── Security Headers ──────────────────────────────────────────

    // 1. HTTPS
    const isHttps = mainRes.url.startsWith("https://");
    results.push({
      name: "HTTPS",
      status: isHttps ? "pass" : "fail",
      value: isHttps ? "Enabled" : "Not enabled",
      details: isHttps ? "Site served over HTTPS" : "Site not using HTTPS — all data transmitted in plaintext",
      category: "headers",
    });

    // 2. HSTS
    const hsts = mainRes.headers.get("strict-transport-security");
    results.push({
      name: "HSTS",
      status: hsts ? "pass" : "warning",
      value: hsts ? "Enabled" : "Missing",
      details: hsts ? `Strict-Transport-Security: ${hsts}` : "HSTS not configured — browser may allow HTTP downgrade",
      category: "headers",
    });

    // 3. X-Frame-Options
    const xfo = mainRes.headers.get("x-frame-options");
    results.push({
      name: "X-Frame-Options",
      status: xfo ? "pass" : "warning",
      value: xfo || "Missing",
      details: xfo ? "Clickjacking protection enabled" : "No clickjacking protection — site can be iframed",
      category: "headers",
    });

    // 4. X-Content-Type-Options
    const xcto = mainRes.headers.get("x-content-type-options");
    results.push({
      name: "X-Content-Type-Options",
      status: xcto ? "pass" : "warning",
      value: xcto || "Missing",
      details: xcto ? "MIME sniffing protection enabled" : "MIME type sniffing not prevented",
      category: "headers",
    });

    // 5. Content-Security-Policy
    const csp = mainRes.headers.get("content-security-policy");
    results.push({
      name: "Content-Security-Policy",
      status: csp ? "pass" : "warning",
      value: csp ? "Set" : "Missing",
      details: csp ? "CSP configured" : "No Content-Security-Policy — XSS risk",
      category: "headers",
    });

    // 6. Referrer-Policy
    const referrer = mainRes.headers.get("referrer-policy");
    results.push({
      name: "Referrer-Policy",
      status: referrer ? "pass" : "warning",
      value: referrer || "Missing",
      details: referrer ? `Referrer-Policy: ${referrer}` : "No referrer policy set",
      category: "headers",
    });

    // 7. Permissions-Policy
    const permissions = mainRes.headers.get("permissions-policy");
    results.push({
      name: "Permissions-Policy",
      status: permissions ? "pass" : "warning",
      value: permissions ? "Set" : "Missing",
      details: permissions ? "Permissions policy configured" : "No permissions policy — browser features unrestricted",
      category: "headers",
    });

    // ─── Server Info Exposure ──────────────────────────────────────

    // 8. Server header
    const server = mainRes.headers.get("server");
    const serverExposes = server && (server.toLowerCase().includes("apache") || server.toLowerCase().includes("nginx") || server.toLowerCase().includes("iis"));
    results.push({
      name: "Server Header",
      status: server ? (serverExposes ? "warning" : "pass") : "pass",
      value: server || "Hidden",
      details: server
        ? serverExposes
          ? `Server software exposed: ${server}`
          : "Server header set but not exposing details"
        : "Server header hidden — good",
      category: "server",
    });

    // 9. X-Powered-By
    const poweredBy = mainRes.headers.get("x-powered-by");
    results.push({
      name: "X-Powered-By",
      status: poweredBy ? "warning" : "pass",
      value: poweredBy || "Hidden",
      details: poweredBy
        ? `Technology exposed: ${poweredBy} — remove this header`
        : "X-Powered-By hidden — good",
      category: "server",
    });

    // 10. WordPress version in HTML
    const wpVersionMatch = html.match(/content="WordPress\s+([\d.]+)"/i)
      || html.match(/\?ver=([\d.]+)/);
    results.push({
      name: "WordPress Version Exposed",
      status: wpVersionMatch ? "warning" : "pass",
      value: wpVersionMatch ? wpVersionMatch[1]! : "Hidden",
      details: wpVersionMatch
        ? `WordPress version ${wpVersionMatch[1]} exposed in source — remove generator meta tag`
        : "WordPress version not exposed in HTML",
      category: "wordpress",
    });

    // ─── WordPress-Specific Checks ─────────────────────────────────

    // 11. XML-RPC
    const xmlrpc = await fetchWithTimeout(`${baseUrl}/xmlrpc.php`, { method: "POST" });
    const xmlrpcAccessible = xmlrpc && xmlrpc.status !== 404 && xmlrpc.status !== 403;
    results.push({
      name: "XML-RPC",
      status: xmlrpcAccessible ? "warning" : "pass",
      value: xmlrpcAccessible ? `Enabled (${xmlrpc!.status})` : "Disabled/Blocked",
      details: xmlrpcAccessible
        ? "XML-RPC is accessible — potential brute force and DDoS vector"
        : "XML-RPC blocked or disabled — good",
      category: "wordpress",
    });

    // 12. WP Login page
    const loginRes = await fetchWithTimeout(`${baseUrl}/wp-login.php`);
    const loginAccessible = loginRes && loginRes.ok;
    results.push({
      name: "Login Page Exposed",
      status: loginAccessible ? "warning" : "pass",
      value: loginAccessible ? "Accessible" : "Hidden/Protected",
      details: loginAccessible
        ? "Default wp-login.php is publicly accessible — consider hiding or protecting it"
        : "Login page hidden or redirected — good",
      category: "wordpress",
    });

    // 13. User enumeration (/?author=1)
    const authorRes = await fetchWithTimeout(`${baseUrl}/?author=1`, { redirect: "manual" });
    const authorEnumerable = authorRes && (authorRes.status === 301 || authorRes.status === 302);
    const authorLocation = authorRes?.headers.get("location") || "";
    const exposedUsername = authorLocation.match(/\/author\/([^/]+)/)?.[1];
    results.push({
      name: "User Enumeration",
      status: authorEnumerable ? "warning" : "pass",
      value: exposedUsername ? `Username: ${exposedUsername}` : (authorEnumerable ? "Possible" : "Blocked"),
      details: authorEnumerable
        ? `Author enumeration redirects to ${authorLocation} — usernames discoverable`
        : "Author enumeration blocked — good",
      category: "wordpress",
    });

    // 14. REST API user listing
    const restUsersRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users`);
    const restUsersAccessible = restUsersRes && restUsersRes.ok;
    results.push({
      name: "REST API User Listing",
      status: restUsersAccessible ? "warning" : "pass",
      value: restUsersAccessible ? "Exposed" : "Protected",
      details: restUsersAccessible
        ? "User data exposed via REST API — restrict /wp-json/wp/v2/users"
        : "REST API user listing restricted — good",
      category: "wordpress",
    });

    // ─── Exposed Files ─────────────────────────────────────────────

    // 15. wp-config.php
    const wpConfig = await fetchWithTimeout(`${baseUrl}/wp-config.php`);
    const wpConfigExposed = wpConfig && wpConfig.ok && (await wpConfig.text()).length > 0;
    results.push({
      name: "wp-config.php Exposed",
      status: wpConfigExposed ? "fail" : "pass",
      value: wpConfigExposed ? "EXPOSED" : "Protected",
      details: wpConfigExposed
        ? "CRITICAL: wp-config.php contents accessible — database credentials may be leaked"
        : "wp-config.php properly protected",
      category: "access",
    });

    // 16. readme.html
    const readme = await fetchWithTimeout(`${baseUrl}/readme.html`);
    const readmeExposed = readme && readme.ok;
    results.push({
      name: "readme.html Exposed",
      status: readmeExposed ? "warning" : "pass",
      value: readmeExposed ? "Accessible" : "Removed/Blocked",
      details: readmeExposed
        ? "WordPress readme.html accessible — reveals version info"
        : "readme.html not accessible — good",
      category: "access",
    });

    // 17. Debug mode in HTML
    const debugExposed = html.includes("Fatal error") || html.includes("Warning:") || html.includes("Notice:");
    results.push({
      name: "PHP Errors Visible",
      status: debugExposed ? "fail" : "pass",
      value: debugExposed ? "Visible" : "Hidden",
      details: debugExposed
        ? "PHP errors visible in HTML — disable display_errors in production"
        : "No PHP errors visible in frontend",
      category: "server",
    });

    // 18. Directory listing (wp-content/uploads)
    const uploads = await fetchWithTimeout(`${baseUrl}/wp-content/uploads/`);
    const uploadsListing = uploads && uploads.ok && (await uploads.text()).includes("Index of");
    results.push({
      name: "Directory Listing",
      status: uploadsListing ? "warning" : "pass",
      value: uploadsListing ? "Enabled" : "Disabled",
      details: uploadsListing
        ? "Directory listing enabled on /wp-content/uploads/ — file structure exposed"
        : "Directory listing disabled — good",
      category: "access",
    });

    // ─── Calculate Score ──────────────────────────────────────────

    const passCount = results.filter((r) => r.status === "pass").length;
    const warnCount = results.filter((r) => r.status === "warning").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    const total = results.length;
    const score = Math.round(((passCount + warnCount * 0.4) / total) * 100);

    const duration = Date.now() - startTime;

    const summary = {
      score,
      totalChecks: total,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
    };

    await admin
      .from("site_checks")
      .update({
        status: "completed" as const,
        score,
        summary,
        results: results as unknown as Record<string, unknown>[],
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: true,
      checkId,
      score,
      summary,
      results,
      duration,
    });
  } catch (e) {
    const duration = Date.now() - startTime;

    await admin
      .from("site_checks")
      .update({
        status: "failed" as const,
        summary: { error: e instanceof Error ? e.message : "Unknown error" },
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: false,
      checkId,
      error: e instanceof Error ? e.message : "Security audit failed",
    }, { status: 500 });
  }
}
