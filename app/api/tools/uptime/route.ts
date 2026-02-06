import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = rateLimit(`tools:uptime:${ip}`, { windowMs: 60_000, maxRequests: 5 });
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

  // Parse request
  const body = await request.json();
  const { websiteId } = body as { websiteId: string };

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  // Get website
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
      check_type: "uptime" as const,
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
    const results: Record<string, unknown>[] = [];

    // 1. HTTP Status + Response Time
    const fetchStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const pageRes = await fetch(website.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ClientDashboard-UptimeMonitor/1.0" },
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - fetchStart;

    const isUp = pageRes.ok;
    const statusCode = pageRes.status;

    results.push({
      name: "HTTP Status",
      status: isUp ? "pass" : "fail",
      value: `${statusCode} ${pageRes.statusText}`,
      details: isUp ? "Website is reachable" : `Returned HTTP ${statusCode}`,
    });

    results.push({
      name: "Response Time",
      status: responseTime < 1000 ? "pass" : responseTime < 3000 ? "warning" : "fail",
      value: `${responseTime}ms`,
      details: responseTime < 1000
        ? "Fast response"
        : responseTime < 3000
          ? "Moderate response time"
          : "Slow response time",
    });

    // 2. SSL Certificate check
    const urlObj = new URL(website.url);
    if (urlObj.protocol === "https:") {
      // We can't directly check SSL from Node, but we can verify HTTPS works
      // and check via headers
      const isSecure = pageRes.url.startsWith("https://");
      results.push({
        name: "SSL/HTTPS",
        status: isSecure ? "pass" : "fail",
        value: isSecure ? "Valid" : "Not secure",
        details: isSecure ? "HTTPS connection established" : "Site not served over HTTPS",
      });

      // Check for HSTS header
      const hsts = pageRes.headers.get("strict-transport-security");
      results.push({
        name: "HSTS Header",
        status: hsts ? "pass" : "warning",
        value: hsts ? "Enabled" : "Not set",
        details: hsts ? "Strict Transport Security enabled" : "HSTS not configured",
      });
    } else {
      results.push({
        name: "SSL/HTTPS",
        status: "fail",
        value: "Not using HTTPS",
        details: "Website not served over HTTPS — insecure",
      });
    }

    // 3. Security headers
    const secHeaders = [
      {
        name: "X-Frame-Options",
        header: pageRes.headers.get("x-frame-options"),
        description: "Clickjacking protection",
      },
      {
        name: "X-Content-Type-Options",
        header: pageRes.headers.get("x-content-type-options"),
        description: "MIME type sniffing protection",
      },
      {
        name: "Content-Security-Policy",
        header: pageRes.headers.get("content-security-policy"),
        description: "Content security policy",
      },
    ];

    for (const sh of secHeaders) {
      results.push({
        name: sh.name,
        status: sh.header ? "pass" : "warning",
        value: sh.header ? "Set" : "Missing",
        details: sh.header ? `${sh.description}: configured` : `${sh.description}: not set`,
      });
    }

    // 4. Page size
    const contentLength = pageRes.headers.get("content-length");
    const body = await pageRes.text();
    const pageSize = contentLength ? parseInt(contentLength, 10) : body.length;
    const pageSizeKb = Math.round(pageSize / 1024);

    results.push({
      name: "Page Size",
      status: pageSizeKb < 500 ? "pass" : pageSizeKb < 2000 ? "warning" : "fail",
      value: pageSizeKb < 1024 ? `${pageSizeKb} KB` : `${(pageSizeKb / 1024).toFixed(1)} MB`,
      details: pageSizeKb < 500
        ? "Good page size"
        : pageSizeKb < 2000
          ? "Moderate page size"
          : "Large page size — consider optimization",
    });

    // 5. Compression
    const encoding = pageRes.headers.get("content-encoding");
    results.push({
      name: "Compression",
      status: encoding ? "pass" : "warning",
      value: encoding || "None",
      details: encoding ? `${encoding} compression enabled` : "No compression detected",
    });

    // 6. Redirect chain
    const finalUrl = pageRes.url;
    const hasRedirect = finalUrl !== website.url && new URL(finalUrl).pathname !== new URL(website.url).pathname;
    results.push({
      name: "Redirects",
      status: hasRedirect ? "warning" : "pass",
      value: hasRedirect ? `Redirected to ${finalUrl}` : "No redirects",
      details: hasRedirect ? "URL redirects to a different page" : "Direct access, no redirects",
    });

    const duration = Date.now() - startTime;

    const passCount = results.filter((r) => r.status === "pass").length;
    const warnCount = results.filter((r) => r.status === "warning").length;
    const failCount = results.filter((r) => r.status === "fail").length;

    const summary = {
      isUp,
      statusCode,
      responseTime,
      pageSize: pageSizeKb,
      totalChecks: results.length,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
    };

    // Update check record
    await admin
      .from("site_checks")
      .update({
        status: "completed" as const,
        summary,
        results,
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: true,
      checkId: checkId,
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
        summary: {
          isUp: false,
          error: e instanceof Error ? e.message : "Unknown error",
        },
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: false,
      checkId: checkId,
      error: e instanceof Error ? e.message : "Check failed",
      summary: { isUp: false },
    }, { status: 500 });
  }
}
