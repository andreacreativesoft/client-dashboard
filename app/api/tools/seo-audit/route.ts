import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT = 10000;
const MAX_PAGES = 20;

type SeoItem = {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string | null;
  details: string;
  weight: number;
};

type PageAudit = {
  url: string;
  path: string;
  items: SeoItem[];
  score: number;
  passed: number;
  warnings: number;
  failed: number;
};

// ─── HTML analyzer (works on any page) ──────────────────────────────

function analyzeHtml(html: string, url: string): SeoItem[] {
  const items: SeoItem[] = [];

  // 1. Title tag
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1]?.trim() || null : null;
  const titleLen = title?.length || 0;
  items.push({
    name: "Page Title",
    status: !title ? "fail" : titleLen < 30 || titleLen > 65 ? "warning" : "pass",
    value: title,
    details: !title
      ? "Missing <title> tag"
      : titleLen < 30
        ? `Too short (${titleLen} chars, recommended 50-60)`
        : titleLen > 65
          ? `Too long (${titleLen} chars, recommended 50-60)`
          : `Good length (${titleLen} chars)`,
    weight: 15,
  });

  // 2. Meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const desc = descMatch ? descMatch[1]?.trim() || null : null;
  const descLen = desc?.length || 0;
  items.push({
    name: "Meta Description",
    status: !desc ? "fail" : descLen < 120 || descLen > 165 ? "warning" : "pass",
    value: desc ? (desc.length > 80 ? desc.substring(0, 80) + "..." : desc) : null,
    details: !desc
      ? "Missing meta description"
      : descLen < 120
        ? `Too short (${descLen} chars, recommended 150-160)`
        : descLen > 165
          ? `Too long (${descLen} chars, recommended 150-160)`
          : `Good length (${descLen} chars)`,
    weight: 10,
  });

  // 3. H1 tag — exactly one
  const h1Matches = html.match(/<h1[^>]*>/gi) || [];
  const h1Content = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  items.push({
    name: "H1 Tag",
    status: h1Matches.length === 1 ? "pass" : h1Matches.length === 0 ? "fail" : "warning",
    value: h1Content ? h1Content[1]?.trim() || null : null,
    details: h1Matches.length === 0
      ? "No H1 tag found"
      : h1Matches.length > 1
        ? `Multiple H1 tags found (${h1Matches.length})`
        : "Single H1 tag present",
    weight: 10,
  });

  // 4. Heading hierarchy
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const headings: number[] = [];
  let headingMatch;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    headings.push(parseInt(headingMatch[1]!, 10));
  }

  let hierarchyOk = true;
  let hierarchyDetails = "Proper heading hierarchy";
  for (let i = 1; i < headings.length; i++) {
    const current = headings[i]!;
    const previous = headings[i - 1]!;
    if (current > previous + 1) {
      hierarchyOk = false;
      hierarchyDetails = `Skipped heading level: H${previous} → H${current}`;
      break;
    }
  }
  items.push({
    name: "Heading Hierarchy",
    status: headings.length === 0 ? "warning" : hierarchyOk ? "pass" : "warning",
    value: headings.length > 0 ? headings.map((h) => `H${h}`).join(" → ") : null,
    details: headings.length === 0 ? "No headings found" : hierarchyDetails,
    weight: 8,
  });

  // 5. Image alt texts
  const imgRegex = /<img[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  const missingAlt = imgs.filter((img) => !img.match(/alt=["'][^"']+["']/i));
  items.push({
    name: "Image Alt Text",
    status: imgs.length === 0 ? "pass" : missingAlt.length === 0 ? "pass" : missingAlt.length <= 2 ? "warning" : "fail",
    value: `${imgs.length - missingAlt.length}/${imgs.length} images have alt text`,
    details: imgs.length === 0
      ? "No images found"
      : missingAlt.length === 0
        ? "All images have alt text"
        : `${missingAlt.length} of ${imgs.length} images missing alt text`,
    weight: 8,
  });

  // 6. Open Graph tags
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
  const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  items.push({
    name: "Open Graph Tags",
    status: ogCount === 3 ? "pass" : ogCount > 0 ? "warning" : "fail",
    value: `${ogCount}/3 OG tags present`,
    details: ogCount === 3
      ? "og:title, og:description, og:image all present"
      : `Missing: ${[!ogTitle && "og:title", !ogDesc && "og:description", !ogImage && "og:image"].filter(Boolean).join(", ")}`,
    weight: 10,
  });

  // 7. Canonical URL
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  items.push({
    name: "Canonical URL",
    status: canonical ? "pass" : "warning",
    value: canonical ? canonical[1] || null : null,
    details: canonical ? "Canonical URL set" : "No canonical URL specified",
    weight: 7,
  });

  // 8. Robots meta
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);
  const hasNoindex = robots && robots[1]?.includes("noindex");
  items.push({
    name: "Robots Meta",
    status: hasNoindex ? "warning" : "pass",
    value: robots ? robots[1] || null : "Not set (default: index, follow)",
    details: hasNoindex ? "Page set to noindex" : robots ? "Robots directive present" : "No robots meta (defaults to index, follow)",
    weight: 7,
  });

  // Viewport meta
  const viewport = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i);
  items.push({
    name: "Viewport Meta",
    status: viewport ? "pass" : "fail",
    value: viewport ? "Set" : null,
    details: viewport ? "Mobile viewport configured" : "Missing viewport meta tag — bad for mobile",
    weight: 5,
  });

  // Language attribute
  const lang = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
  items.push({
    name: "HTML Lang Attribute",
    status: lang ? "pass" : "warning",
    value: lang ? lang[1] || null : null,
    details: lang ? `Language set to "${lang[1]}"` : "No lang attribute on <html> tag",
    weight: 5,
  });

  // Charset
  const charset = html.match(/<meta[^>]+charset=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)/i);
  items.push({
    name: "Character Encoding",
    status: charset ? "pass" : "warning",
    value: charset ? charset[1] || null : null,
    details: charset ? `Charset: ${charset[1]}` : "No charset declaration found",
    weight: 5,
  });

  return items;
}

// ─── Fetch a page with timeout ──────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ClientDashboard-SEOAuditor/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Get URLs from sitemap ──────────────────────────────────────────

async function getUrlsFromSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];

  try {
    // Try sitemap.xml
    const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
    const html = await fetchPage(sitemapUrl);
    if (!html) return urls;

    // Check if this is a sitemap index (contains other sitemaps)
    const sitemapIndexMatches = html.match(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi);

    if (sitemapIndexMatches && sitemapIndexMatches.length > 0) {
      // It's a sitemap index — fetch child sitemaps
      for (const match of sitemapIndexMatches) {
        const locMatch = match.match(/<loc>([^<]+)<\/loc>/i);
        if (!locMatch?.[1]) continue;
        const childUrl = locMatch[1].trim();

        const childHtml = await fetchPage(childUrl);
        if (!childHtml) continue;

        // Extract URLs from child sitemap
        const locMatches = childHtml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi);
        for (const m of locMatches) {
          if (m[1]) urls.push(m[1].trim());
          if (urls.length >= MAX_PAGES) break;
        }

        if (urls.length >= MAX_PAGES) break;
      }
    } else {
      // Regular sitemap — extract URLs directly
      const locMatches = html.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi);
      for (const m of locMatches) {
        if (m[1]) urls.push(m[1].trim());
        if (urls.length >= MAX_PAGES) break;
      }
    }
  } catch {
    // Sitemap parsing failed — we'll just use the homepage
  }

  return urls;
}

// ─── Calculate score for a set of items ─────────────────────────────

function calcScore(items: SeoItem[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  const earnedWeight = items.reduce((sum, item) => {
    if (item.status === "pass") return sum + item.weight;
    if (item.status === "warning") return sum + item.weight * 0.5;
    return sum;
  }, 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

// ─── Route handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const limit = await rateLimit(`tools:seo:${ip}`, { windowMs: 60_000, maxRequests: 5 });
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
      check_type: "seo_audit" as const,
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
    // 1. Get all page URLs from sitemap
    let pageUrls = await getUrlsFromSitemap(website.url);

    // Always ensure homepage is included and first
    const normalizedBase = website.url.replace(/\/$/, "");
    pageUrls = pageUrls.filter(
      (u) => u.replace(/\/$/, "") !== normalizedBase
    );
    pageUrls.unshift(website.url);

    // Cap at MAX_PAGES
    pageUrls = pageUrls.slice(0, MAX_PAGES);

    // 2. Audit each page
    const pageAudits: PageAudit[] = [];

    for (const pageUrl of pageUrls) {
      const html = await fetchPage(pageUrl);
      if (!html) continue;

      const items = analyzeHtml(html, pageUrl);
      const score = calcScore(items);

      let path: string;
      try {
        path = new URL(pageUrl).pathname || "/";
      } catch {
        path = pageUrl;
      }

      pageAudits.push({
        url: pageUrl,
        path,
        items,
        score,
        passed: items.filter((i) => i.status === "pass").length,
        warnings: items.filter((i) => i.status === "warning").length,
        failed: items.filter((i) => i.status === "fail").length,
      });
    }

    // 3. Site-wide checks (only once, not per page)
    const siteWideItems: SeoItem[] = [];

    // Check sitemap.xml
    try {
      const sitemapUrl = new URL("/sitemap.xml", website.url).href;
      const sitemapRes = await fetch(sitemapUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "ClientDashboard-SEOAuditor/1.0" },
      });
      siteWideItems.push({
        name: "Sitemap.xml",
        status: sitemapRes.ok ? "pass" : "warning",
        value: sitemapRes.ok ? sitemapUrl : null,
        details: sitemapRes.ok ? "Sitemap found" : "No sitemap.xml found",
        weight: 10,
      });
    } catch {
      siteWideItems.push({
        name: "Sitemap.xml",
        status: "warning",
        value: null,
        details: "Could not check sitemap.xml",
        weight: 10,
      });
    }

    // Check robots.txt
    try {
      const robotsUrl = new URL("/robots.txt", website.url).href;
      const robotsRes = await fetch(robotsUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "ClientDashboard-SEOAuditor/1.0" },
      });
      siteWideItems.push({
        name: "Robots.txt",
        status: robotsRes.ok ? "pass" : "warning",
        value: robotsRes.ok ? robotsUrl : null,
        details: robotsRes.ok ? "Robots.txt found" : "No robots.txt found",
        weight: 5,
      });
    } catch {
      siteWideItems.push({
        name: "Robots.txt",
        status: "warning",
        value: null,
        details: "Could not check robots.txt",
        weight: 5,
      });
    }

    // 4. Calculate overall score (average of all page scores + site-wide)
    const siteWideScore = calcScore(siteWideItems);
    const allPageScores = pageAudits.map((p) => p.score);
    const avgPageScore = allPageScores.length > 0
      ? Math.round(allPageScores.reduce((a, b) => a + b, 0) / allPageScores.length)
      : 0;

    // Weight: 80% page average, 20% site-wide
    const overallScore = Math.round(avgPageScore * 0.8 + siteWideScore * 0.2);

    const totalPassed = pageAudits.reduce((s, p) => s + p.passed, 0) + siteWideItems.filter((i) => i.status === "pass").length;
    const totalWarnings = pageAudits.reduce((s, p) => s + p.warnings, 0) + siteWideItems.filter((i) => i.status === "warning").length;
    const totalFailed = pageAudits.reduce((s, p) => s + p.failed, 0) + siteWideItems.filter((i) => i.status === "fail").length;
    const totalChecks = totalPassed + totalWarnings + totalFailed;

    const duration = Date.now() - startTime;

    const summary = {
      score: overallScore,
      totalChecks,
      passed: totalPassed,
      warnings: totalWarnings,
      failed: totalFailed,
      pagesAudited: pageAudits.length,
      pagesFound: pageUrls.length,
    };

    // Build flat results for storage (for backward compatibility with DB schema)
    // Include page path in item name for multi-page results
    const flatResults: (SeoItem & { page?: string })[] = [];
    for (const page of pageAudits) {
      for (const item of page.items) {
        flatResults.push({ ...item, page: page.path });
      }
    }
    for (const item of siteWideItems) {
      flatResults.push({ ...item, page: "site-wide" });
    }

    // Update check record
    await admin
      .from("site_checks")
      .update({
        status: "completed" as const,
        score: overallScore,
        summary,
        results: flatResults as unknown as Record<string, unknown>[],
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: true,
      checkId,
      score: overallScore,
      summary,
      pages: pageAudits,
      siteWide: siteWideItems,
      results: flatResults,
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
      error: e instanceof Error ? e.message : "Audit failed",
    }, { status: 500 });
  }
}
