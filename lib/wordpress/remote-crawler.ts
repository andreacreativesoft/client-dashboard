/**
 * Remote WordPress site crawler.
 *
 * Uses the WordPress REST API (via WPClient) to fetch pages, posts, media,
 * plugins, and site health data — then builds the same WPCrawlResult structure
 * that the AI analyzer expects.
 *
 * This replaces the local crawler for sites connected via Application Password,
 * allowing AI Analysis to work from deployed environments (Vercel) without
 * needing local filesystem or MySQL access.
 */

import * as cheerio from "cheerio";
import { WPClient } from "./wp-client";
import type {
  WPCrawlResult,
  WPPageData,
  WPImageData,
  WPPluginData,
  WPPost,
  WPPage,
  WPMediaItem,
  SiteHealthData,
  PluginInfo,
} from "@/types/wordpress";

// ─── Constants ────────────────────────────────────────────────────────

const MAX_PAGES = 100;
const PER_PAGE = 100;

// ─── Page content analyzer ────────────────────────────────────────────

function analyzeRenderedContent(
  html: string,
  title: string,
  siteUrl: string,
  slug: string,
  yoastMeta?: { description?: string; og_title?: string; og_description?: string }
): WPPageData {
  const $ = cheerio.load(html);
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const fullUrl = `${cleanSiteUrl}/${slug}/`;

  // Headings
  const h1Tags: string[] = [];
  $("h1").each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1Tags.push(text);
  });

  // Images
  const images: WPImageData[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = $(el).attr("alt") || null;
    const loading = $(el).attr("loading");
    const srcParts = src.split(".");
    const format = srcParts.length > 1 ? (srcParts.pop() || "unknown").toLowerCase().split("?")[0] || "unknown" : "unknown";

    images.push({
      src,
      alt: alt && alt.trim() ? alt.trim() : null,
      size_kb: 0, // Will be estimated via HEAD requests if needed
      format,
      lazy: loading === "lazy",
    });
  });

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  let siteDomain: string;
  try {
    siteDomain = new URL(siteUrl).hostname;
  } catch {
    siteDomain = "";
  }

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
      // Invalid URL, skip
    }
  });

  // Word count
  const textContent = $.text().replace(/\s+/g, " ").trim();
  const wordCount = textContent ? textContent.split(/\s+/).length : 0;

  // Schema markup
  let hasSchema = false;
  $('script[type="application/ld+json"]').each(() => {
    hasSchema = true;
  });

  // Open Graph
  const hasOgTags = !!(yoastMeta?.og_title || yoastMeta?.og_description ||
    $('meta[property="og:title"]').length || $('meta[property="og:description"]').length);

  // Meta description — from Yoast head JSON if available
  const metaDesc = yoastMeta?.description ||
    $('meta[name="description"]').attr("content") || null;

  return {
    url: fullUrl,
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

// ─── Image size estimation via HEAD requests ──────────────────────────

async function estimateImageSizeRemote(src: string): Promise<number> {
  if (!src || !src.startsWith("http")) return 0;
  try {
    const resp = await fetch(src, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    const contentLength = resp.headers.get("content-length");
    if (contentLength) {
      return Math.round(parseInt(contentLength, 10) / 1024);
    }
  } catch {
    // Timeout or network error
  }
  return 0;
}

// ─── Convert PluginInfo to WPPluginData ──────────────────────────────

function pluginInfoToCrawlData(plugin: PluginInfo): WPPluginData {
  return {
    name: plugin.name,
    slug: plugin.slug,
    version: plugin.version,
    active: plugin.status === "active" || plugin.status === "must-use",
    loads_on: "all", // Can't determine from REST API
    assets: [], // Can't scan PHP files remotely
    total_js_kb: 0,
    total_css_kb: 0,
  };
}

// ─── Main remote crawler ──────────────────────────────────────────────

/**
 * Crawl a WordPress site remotely via REST API and extract SEO/performance data.
 * Requires an active WPClient connection with mu-plugin installed for full data.
 */
export async function crawlWordPressSiteRemote(
  client: WPClient,
  siteUrl: string
): Promise<WPCrawlResult> {
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");

  // Fetch data in parallel where possible
  const [pages, posts, media, healthResult, pluginsResult] = await Promise.allSettled([
    client.getPages({ per_page: PER_PAGE, page: 1 }),
    client.getPosts({ per_page: PER_PAGE, page: 1 }),
    client.getMedia({ per_page: PER_PAGE, page: 1 }),
    client.getSiteHealth().catch(() => null),
    client.getPlugins().catch(() => []),
  ]);

  const wpPages: WPPage[] = pages.status === "fulfilled" ? pages.value : [];
  const wpPosts: WPPost[] = posts.status === "fulfilled" ? posts.value : [];
  const wpMedia: WPMediaItem[] = media.status === "fulfilled" ? media.value : [];
  const siteHealth: SiteHealthData | null = healthResult.status === "fulfilled" ? healthResult.value : null;
  const plugins: PluginInfo[] = pluginsResult.status === "fulfilled" ? pluginsResult.value : [];

  // Combine pages and posts
  const allContent = [
    ...wpPages.map((p) => ({
      title: p.title?.rendered || "",
      content: p.content?.rendered || "",
      slug: p.slug,
      yoast: p.yoast_head_json,
    })),
    ...wpPosts.map((p) => ({
      title: p.title?.rendered || "",
      content: p.content?.rendered || "",
      slug: p.slug,
      yoast: p.yoast_head_json,
    })),
  ].slice(0, MAX_PAGES);

  // Analyze each page
  const analyzedPages: WPPageData[] = [];
  let totalImages = 0;
  let missingAlt = 0;
  let missingMeta = 0;

  for (const item of allContent) {
    const pageData = analyzeRenderedContent(
      item.content,
      item.title,
      cleanSiteUrl,
      item.slug,
      item.yoast ? {
        description: item.yoast.description,
        og_title: item.yoast.og_title,
        og_description: item.yoast.og_description,
      } : undefined
    );

    totalImages += pageData.images.length;
    missingAlt += pageData.images.filter((img) => !img.alt).length;
    if (!pageData.meta_description) missingMeta++;

    analyzedPages.push(pageData);
  }

  // Enrich with media library data — find images missing alt text from the library
  const mediaWithoutAlt = wpMedia.filter((m) => !m.alt_text);
  // Add media library stats to totals (for images not already counted in pages)
  const pageImageSrcs = new Set(
    analyzedPages.flatMap((p) => p.images.map((img) => img.src))
  );
  for (const mediaItem of wpMedia) {
    if (!pageImageSrcs.has(mediaItem.source_url)) {
      totalImages++;
      if (!mediaItem.alt_text) missingAlt++;
    }
  }

  // Estimate sizes for a sample of large-looking images (limit to avoid too many requests)
  const imageSamples = analyzedPages
    .flatMap((p) => p.images)
    .filter((img) => img.src.startsWith("http"))
    .slice(0, 20);

  const sizePromises = imageSamples.map(async (img) => {
    img.size_kb = await estimateImageSizeRemote(img.src);
  });
  await Promise.allSettled(sizePromises);

  // Build plugin data
  const crawlPlugins: WPPluginData[] = plugins
    .filter((p) => p.status === "active" || p.status === "must-use")
    .map(pluginInfoToCrawlData);

  // Build result
  return {
    site_url: cleanSiteUrl,
    pages: analyzedPages,
    total_pages: analyzedPages.length,
    total_images: totalImages,
    missing_alt: missingAlt,
    missing_meta: missingMeta,
    plugins: crawlPlugins,
    theme: {
      name: siteHealth?.active_theme?.name || "Unknown",
      version: siteHealth?.active_theme?.version || "",
    },
    database: {
      // Database stats not available remotely without mu-plugin extensions
      // We provide zeros — the AI analyzer handles missing data gracefully
      revisions: 0,
      transients: 0,
      expired_transients: 0,
      autoload_kb: 0,
      spam_comments: 0,
    },
    server: {
      php_version: siteHealth?.php_version || "Unknown",
      wp_version: siteHealth?.wp_version || "Unknown",
    },
    crawled_at: new Date().toISOString(),
  };
}
