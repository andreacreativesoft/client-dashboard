import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT = 10000;

type SeoItem = {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string | null;
  details: string;
  weight: number;
};

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
    // Fetch homepage
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const pageRes = await fetch(website.url, {
      signal: controller.signal,
      headers: { "User-Agent": "ClientDashboard-SEOAuditor/1.0" },
    });
    clearTimeout(timeout);

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch page: HTTP ${pageRes.status}`);
    }

    const html = await pageRes.text();

    // Analyze HTML
    const seoItems = analyzeHtml(html, website.url);

    // Check sitemap.xml
    try {
      const sitemapUrl = new URL("/sitemap.xml", website.url).href;
      const sitemapRes = await fetch(sitemapUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "ClientDashboard-SEOAuditor/1.0" },
      });
      seoItems.push({
        name: "Sitemap.xml",
        status: sitemapRes.ok ? "pass" : "warning",
        value: sitemapRes.ok ? sitemapUrl : null,
        details: sitemapRes.ok ? "Sitemap found" : "No sitemap.xml found",
        weight: 10,
      });
    } catch {
      seoItems.push({
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
      seoItems.push({
        name: "Robots.txt",
        status: robotsRes.ok ? "pass" : "warning",
        value: robotsRes.ok ? robotsUrl : null,
        details: robotsRes.ok ? "Robots.txt found" : "No robots.txt found",
        weight: 5,
      });
    } catch {
      seoItems.push({
        name: "Robots.txt",
        status: "warning",
        value: null,
        details: "Could not check robots.txt",
        weight: 5,
      });
    }

    // Calculate overall score
    const totalWeight = seoItems.reduce((sum, item) => sum + item.weight, 0);
    const earnedWeight = seoItems.reduce((sum, item) => {
      if (item.status === "pass") return sum + item.weight;
      if (item.status === "warning") return sum + item.weight * 0.5;
      return sum;
    }, 0);
    const score = Math.round((earnedWeight / totalWeight) * 100);

    const duration = Date.now() - startTime;

    const passCount = seoItems.filter((i) => i.status === "pass").length;
    const warnCount = seoItems.filter((i) => i.status === "warning").length;
    const failCount = seoItems.filter((i) => i.status === "fail").length;

    const summary = {
      score,
      totalChecks: seoItems.length,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
    };

    // Update check record
    await admin
      .from("site_checks")
      .update({
        status: "completed" as const,
        score,
        summary,
        results: seoItems as unknown as Record<string, unknown>[],
        duration_ms: duration,
      })
      .eq("id", checkId);

    return NextResponse.json({
      success: true,
      checkId: checkId,
      score,
      summary,
      results: seoItems,
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
      error: e instanceof Error ? e.message : "Audit failed",
    }, { status: 500 });
  }
}
