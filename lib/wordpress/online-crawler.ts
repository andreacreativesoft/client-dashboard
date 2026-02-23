/**
 * Online WordPress site crawler.
 *
 * Collects the same WPCrawlResult data as the local crawler, but via
 * HTTP page fetching + WP REST API + mu-plugin db-health endpoint.
 * Works from Vercel / any hosted environment — no local filesystem needed.
 */

import * as cheerio from "cheerio";
import { WPClient } from "@/lib/wordpress/wp-client";
import type {
  WPCrawlResult,
  WPPageData,
  WPImageData,
  WPPluginData,
} from "@/types/wordpress";

// ─── Constants ────────────────────────────────────────────────────────

const MAX_PAGES = 100;
const FETCH_TIMEOUT = 15000;
const USER_AGENT = "ClientDashboard-AIAnalyzer/1.0";

// ─── Fetch page HTML ──────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Get image size via HEAD request ──────────────────────────────────

async function getImageSizeKb(url: string): Promise<number> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": USER_AGENT },
    });
    const len = res.headers.get("content-length");
    if (len) return Math.round(parseInt(len, 10) / 1024);
  } catch {
    // Ignore
  }
  return 0;
}

// ─── Get URLs from sitemap ────────────────────────────────────────────

async function getUrlsFromSitemap(baseUrl: string): Promise<string[]> {
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"];

  for (const path of sitemapPaths) {
    try {
      const sitemapUrl = new URL(path, baseUrl).href;
      const xml = await fetchPage(sitemapUrl);
      if (!xml) continue;

      const urls = await parseSitemapXml(xml);
      if (urls.length > 0) return urls;
    } catch {
      // Try next
    }
  }

  return [];
}

async function parseSitemapXml(xml: string): Promise<string[]> {
  const urls: string[] = [];

  // Check for sitemap index
  const sitemapIndexMatches = xml.match(
    /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi
  );

  if (sitemapIndexMatches && sitemapIndexMatches.length > 0) {
    for (const match of sitemapIndexMatches) {
      const locMatch = match.match(/<loc>([^<]+)<\/loc>/i);
      if (!locMatch?.[1]) continue;

      const childXml = await fetchPage(locMatch[1].trim());
      if (!childXml) continue;

      const locMatches = childXml.matchAll(
        /<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi
      );
      for (const m of locMatches) {
        if (m[1]) urls.push(m[1].trim());
        if (urls.length >= MAX_PAGES) break;
      }
      if (urls.length >= MAX_PAGES) break;
    }
  } else {
    const locMatches = xml.matchAll(
      /<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi
    );
    for (const m of locMatches) {
      if (m[1]) urls.push(m[1].trim());
      if (urls.length >= MAX_PAGES) break;
    }
  }

  return urls;
}

// ─── Analyze page HTML ────────────────────────────────────────────────

function analyzePage(
  html: string,
  pageUrl: string,
  siteUrl: string
): WPPageData {
  const $ = cheerio.load(html);

  // Title from <title> tag
  const title = $("title").first().text().trim() || "";

  // Meta description
  const metaDesc = $('meta[name="description"]').attr("content") || null;

  // H1 tags
  const h1Tags: string[] = [];
  $("h1").each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1Tags.push(text);
  });

  // Images
  const images: WPImageData[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (!src) return;
    const alt = $(el).attr("alt") || null;
    const loading = $(el).attr("loading");
    const ext = src.split("?")[0]?.split(".").pop()?.toLowerCase() || "unknown";

    images.push({
      src,
      alt: alt && alt.trim() ? alt.trim() : null,
      size_kb: 0, // Will be filled in batch
      format: ext,
      lazy: loading === "lazy",
    });
  });

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  const siteDomain = (() => {
    try { return new URL(siteUrl).hostname; } catch { return ""; }
  })();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      if (href.startsWith("/") || href.startsWith("#")) {
        internalLinks++;
      } else if (href.startsWith("http")) {
        const linkDomain = new URL(href).hostname;
        if (linkDomain === siteDomain) {
          internalLinks++;
        } else {
          externalLinks++;
        }
      }
    } catch {
      // Invalid URL
    }
  });

  // Word count
  const textContent = $.text().replace(/\s+/g, " ").trim();
  const wordCount = textContent ? textContent.split(/\s+/).length : 0;

  // Schema markup (JSON-LD)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;

  // Open Graph
  const hasOgTags = !!(
    $('meta[property="og:title"]').length ||
    $('meta[property="og:description"]').length
  );

  return {
    url: pageUrl,
    title,
    meta_description: metaDesc,
    h1: h1Tags,
    h2_count: $("h2").length,
    h3_count: $("h3").length,
    word_count: wordCount,
    images,
    has_schema: hasSchema,
    has_og_tags: hasOgTags,
    internal_links: internalLinks,
    external_links: externalLinks,
  };
}

// ─── Analyze loaded scripts/styles from HTML ──────────────────────────

function analyzePageAssets(
  html: string,
  siteUrl: string
): { scripts: string[]; styles: string[] } {
  const $ = cheerio.load(html);
  const scripts: string[] = [];
  const styles: string[] = [];
  const siteDomain = (() => {
    try { return new URL(siteUrl).hostname; } catch { return ""; }
  })();

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src.includes("wp-content/plugins/")) {
      scripts.push(src);
    }
  });

  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("wp-content/plugins/")) {
      styles.push(href);
    }
  });

  return { scripts, styles };
}

// ─── Build plugin data from loaded assets ─────────────────────────────

function buildPluginDataFromAssets(
  scripts: string[],
  styles: string[],
  wpPlugins: Array<{ slug: string; name: string; version: string; status: string }>
): WPPluginData[] {
  // Build a map of plugin slugs to loaded assets
  const pluginAssets = new Map<string, { js: string[]; css: string[] }>();

  for (const src of scripts) {
    const match = src.match(/wp-content\/plugins\/([^/]+)\//);
    if (match?.[1]) {
      const slug = match[1];
      const entry = pluginAssets.get(slug) || { js: [], css: [] };
      entry.js.push(src);
      pluginAssets.set(slug, entry);
    }
  }

  for (const href of styles) {
    const match = href.match(/wp-content\/plugins\/([^/]+)\//);
    if (match?.[1]) {
      const slug = match[1];
      const entry = pluginAssets.get(slug) || { js: [], css: [] };
      entry.css.push(href);
      pluginAssets.set(slug, entry);
    }
  }

  // Build plugin data — prefer WP REST API list, fall back to detected assets
  const pluginMap = new Map<string, WPPluginData>();

  // Add all active plugins from REST API
  for (const p of wpPlugins) {
    if (p.status !== "active" && p.status !== "must-use") continue;

    const assets = pluginAssets.get(p.slug);
    pluginMap.set(p.slug, {
      name: p.name,
      slug: p.slug,
      version: p.version,
      active: true,
      loads_on: assets ? "frontend" : "admin",
      assets: [
        ...(assets?.js || []).map((src) => ({
          handle: src.split("/").pop()?.replace(/\.js.*$/, "") || p.slug,
          src,
          type: "js" as const,
          size_kb: 0,
        })),
        ...(assets?.css || []).map((href) => ({
          handle: href.split("/").pop()?.replace(/\.css.*$/, "") || p.slug,
          src: href,
          type: "css" as const,
          size_kb: 0,
        })),
      ],
      total_js_kb: 0,
      total_css_kb: 0,
    });
  }

  // Add plugins detected from page assets that weren't in REST API list
  for (const [slug, assets] of pluginAssets) {
    if (pluginMap.has(slug)) continue;
    pluginMap.set(slug, {
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      slug,
      version: "",
      active: true,
      loads_on: "frontend",
      assets: [
        ...assets.js.map((src) => ({
          handle: src.split("/").pop()?.replace(/\.js.*$/, "") || slug,
          src,
          type: "js" as const,
          size_kb: 0,
        })),
        ...assets.css.map((href) => ({
          handle: href.split("/").pop()?.replace(/\.css.*$/, "") || slug,
          src: href,
          type: "css" as const,
          size_kb: 0,
        })),
      ],
      total_js_kb: 0,
      total_css_kb: 0,
    });
  }

  return Array.from(pluginMap.values());
}

// ─── Main online crawler ──────────────────────────────────────────────

/**
 * Crawl a WordPress site online via HTTP + WP REST API.
 * Returns the same WPCrawlResult structure as the local crawler.
 */
export async function crawlWordPressSiteOnline(
  websiteId: string,
  siteUrl: string
): Promise<WPCrawlResult> {
  const normalizedUrl = siteUrl.replace(/\/+$/, "");

  // ── 1. Get page URLs from sitemap ──────────────────────────────────
  let pageUrls = await getUrlsFromSitemap(normalizedUrl);

  // Ensure homepage is first
  const homepageNorm = normalizedUrl;
  pageUrls = pageUrls.filter(
    (u) => u.replace(/\/+$/, "") !== homepageNorm
  );
  pageUrls.unshift(normalizedUrl);

  // Deduplicate by path
  const seenPaths = new Set<string>();
  pageUrls = pageUrls.filter((u) => {
    try {
      const path = new URL(u).pathname.replace(/\/+$/, "") || "/";
      if (seenPaths.has(path)) return false;
      seenPaths.add(path);
      return true;
    } catch {
      return true;
    }
  });

  pageUrls = pageUrls.slice(0, MAX_PAGES);

  // ── 2. Try to get WP REST API data (plugins, site health, db health)
  let wpPlugins: Array<{ slug: string; name: string; version: string; status: string }> = [];
  let siteHealth: {
    wp_version?: string;
    php_version?: string;
    active_theme?: { name: string; version: string };
  } | null = null;
  let dbHealth: {
    revisions: number;
    transients: number;
    expired_transients: number;
    autoload_kb: number;
    spam_comments: number;
  } | null = null;

  try {
    const client = await WPClient.fromWebsiteId(websiteId);

    // Fetch in parallel
    const [pluginsResult, healthResult, dbResult] = await Promise.allSettled([
      client.getPlugins(),
      client.getSiteHealth(),
      client.getDbHealth(),
    ]);

    if (pluginsResult.status === "fulfilled") {
      wpPlugins = pluginsResult.value.map((p) => ({
        slug: p.slug,
        name: p.name,
        version: p.version,
        status: p.status,
      }));
    }

    if (healthResult.status === "fulfilled") {
      const h = healthResult.value;
      siteHealth = {
        wp_version: h.wp_version,
        php_version: h.php_version,
        active_theme: h.active_theme
          ? { name: h.active_theme.name, version: h.active_theme.version }
          : undefined,
      };
    }

    if (dbResult.status === "fulfilled") {
      dbHealth = dbResult.value;
    }
  } catch {
    // WP REST API / mu-plugin not available — continue with HTTP-only data
    console.log("[Online Crawler] WP REST API not available, using HTTP-only mode");
  }

  // ── 3. Crawl pages via HTTP ────────────────────────────────────────
  const pages: WPPageData[] = [];
  let totalImages = 0;
  let missingAlt = 0;
  let missingMeta = 0;
  let allScripts: string[] = [];
  let allStyles: string[] = [];

  // Crawl pages in batches of 5 for performance
  for (let i = 0; i < pageUrls.length; i += 5) {
    const batch = pageUrls.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const html = await fetchPage(url);
        if (!html) return null;

        const pageData = analyzePage(html, url, normalizedUrl);

        // Get image sizes for first 5 images per page (avoid too many requests)
        const imagePromises = pageData.images.slice(0, 5).map(async (img) => {
          if (img.src.startsWith("http")) {
            img.size_kb = await getImageSizeKb(img.src);
          } else if (img.src.startsWith("/")) {
            img.size_kb = await getImageSizeKb(`${normalizedUrl}${img.src}`);
          }
        });
        await Promise.allSettled(imagePromises);

        // Collect page assets (only from homepage for efficiency)
        if (url === normalizedUrl || url === normalizedUrl + "/") {
          const assets = analyzePageAssets(html, normalizedUrl);
          allScripts = assets.scripts;
          allStyles = assets.styles;
        }

        return pageData;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const pageData = r.value;
        pages.push(pageData);
        totalImages += pageData.images.length;
        missingAlt += pageData.images.filter((img) => !img.alt).length;
        if (!pageData.meta_description) missingMeta++;
      }
    }
  }

  // ── 4. Build plugin data from loaded assets + REST API ─────────────
  const plugins = buildPluginDataFromAssets(allScripts, allStyles, wpPlugins);

  // ── 5. Assemble result ─────────────────────────────────────────────
  return {
    site_url: normalizedUrl,
    pages,
    total_pages: pages.length,
    total_images: totalImages,
    missing_alt: missingAlt,
    missing_meta: missingMeta,
    plugins,
    theme: {
      name: siteHealth?.active_theme?.name || "Unknown",
      version: siteHealth?.active_theme?.version || "",
    },
    database: {
      revisions: dbHealth?.revisions ?? 0,
      transients: dbHealth?.transients ?? 0,
      expired_transients: dbHealth?.expired_transients ?? 0,
      autoload_kb: dbHealth?.autoload_kb ?? 0,
      spam_comments: dbHealth?.spam_comments ?? 0,
    },
    server: {
      php_version: siteHealth?.php_version || "Unknown",
      wp_version: siteHealth?.wp_version || "Unknown",
    },
    crawled_at: new Date().toISOString(),
  };
}
