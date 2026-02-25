import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const MAX_PAGES = 10;
const MAX_LINKS = 100;
const FETCH_TIMEOUT = 5000;

function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  const links = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl).href;
      links.add(resolved);
    } catch {
      // Skip invalid URLs
    }
  }

  return Array.from(links);
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ClientDashboard-LinkChecker/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function checkLink(url: string): Promise<{ url: string; statusCode: number | null; error: string | null; type: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ClientDashboard-LinkChecker/1.0" },
    });
    clearTimeout(timeout);

    return {
      url,
      statusCode: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
      type: "head",
    };
  } catch {
    clearTimeout(timeout);
    // Try GET as fallback (some servers reject HEAD)
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
        headers: { "User-Agent": "ClientDashboard-LinkChecker/1.0" },
      });
      clearTimeout(timeout2);

      return {
        url,
        statusCode: res.status,
        error: res.ok ? null : `HTTP ${res.status}`,
        type: "get",
      };
    } catch (e) {
      clearTimeout(timeout2);
      return {
        url,
        statusCode: null,
        error: e instanceof Error ? e.message : "Connection failed",
        type: "error",
      };
    }
  }
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await rateLimit(`tools:${ip}`, { windowMs: 60_000, maxRequests: 5 });
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
      check_type: "broken_links" as const,
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
    const baseUrl = website.url.replace(/\/$/, "");
    const baseHost = new URL(baseUrl).hostname;

    // ─── Crawl pages to discover links ─────────────────────────────
    // Track which page(s) each link was found on
    const linkSources = new Map<string, Set<string>>(); // link URL → set of source pages
    const crawledPages = new Set<string>();
    const pagesToCrawl: string[] = [baseUrl];

    while (pagesToCrawl.length > 0 && crawledPages.size < MAX_PAGES) {
      const pageUrl = pagesToCrawl.shift()!;
      if (crawledPages.has(pageUrl)) continue;
      crawledPages.add(pageUrl);

      const html = await fetchPage(pageUrl);
      if (!html) continue;

      const pageLabel = pageUrl === baseUrl ? "/" : pageUrl.replace(baseUrl, "") || "/";
      const links = extractLinks(html, pageUrl);

      for (const link of links) {
        if (!linkSources.has(link)) {
          linkSources.set(link, new Set());
        }
        linkSources.get(link)!.add(pageLabel);

        // Queue internal pages for crawling (only HTML pages, skip assets)
        try {
          const linkUrl = new URL(link);
          if (
            linkUrl.hostname === baseHost &&
            !link.match(/\.(jpg|jpeg|png|gif|svg|webp|css|js|pdf|zip|mp4|mp3|woff|woff2|ttf|ico)(\?|$)/i) &&
            crawledPages.size + pagesToCrawl.length < MAX_PAGES
          ) {
            const normalized = linkUrl.origin + linkUrl.pathname.replace(/\/$/, "");
            if (!crawledPages.has(normalized) && !pagesToCrawl.includes(normalized)) {
              pagesToCrawl.push(normalized);
            }
          }
        } catch { /* skip */ }
      }
    }

    // ─── Check all unique links ────────────────────────────────────
    const uniqueLinks = Array.from(linkSources.keys()).slice(0, MAX_LINKS);
    const results: { url: string; statusCode: number | null; error: string | null; type: string; isInternal: boolean; foundOn: string[] }[] = [];

    for (let i = 0; i < uniqueLinks.length; i += 10) {
      const batch = uniqueLinks.slice(i, i + 10);
      const batchResults = await Promise.all(batch.map(checkLink));

      for (const r of batchResults) {
        let isInternal = false;
        try {
          isInternal = new URL(r.url).hostname === baseHost;
        } catch { /* external */ }

        const foundOn = Array.from(linkSources.get(r.url) || []);
        results.push({ ...r, isInternal, foundOn });
      }
    }

    const brokenLinks = results.filter((r) => r.statusCode === null || r.statusCode >= 400);
    const duration = Date.now() - startTime;

    const summary = {
      totalLinks: results.length,
      brokenCount: brokenLinks.length,
      internalBroken: brokenLinks.filter((r) => r.isInternal).length,
      externalBroken: brokenLinks.filter((r) => !r.isInternal).length,
      pagesCrawled: crawledPages.size,
    };

    // Update check record
    await admin
      .from("site_checks")
      .update({
        status: "completed" as const,
        summary,
        results: results as unknown as Record<string, unknown>[],
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
        summary: { error: e instanceof Error ? e.message : "Unknown error" },
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: false,
      checkId: checkId,
      error: e instanceof Error ? e.message : "Check failed",
    }, { status: 500 });
  }
}
