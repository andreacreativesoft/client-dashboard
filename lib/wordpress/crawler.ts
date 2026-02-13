/**
 * WordPress site crawler.
 *
 * Reads wp-config.php to get database credentials, connects to MySQL,
 * and extracts SEO-relevant data from all published pages/posts.
 *
 * Designed to run on the server (Node.js) against local WordPress installations.
 */

import { readFile, access, stat } from "fs/promises";
import { join, extname, resolve } from "path";
import mysql from "mysql2/promise";
import * as cheerio from "cheerio";
import type {
  WPCrawlResult,
  WPPageData,
  WPImageData,
  WPPluginData,
} from "@/types/wordpress";

// ─── Constants ────────────────────────────────────────────────────────

const MAX_PAGES = 100;

// ─── wp-config.php parser ─────────────────────────────────────────────

interface WPDBConfig {
  host: string;
  user: string;
  password: string;
  name: string;
  prefix: string;
}

/**
 * Parse wp-config.php to extract database credentials.
 */
export async function parseWPConfig(localPath: string): Promise<WPDBConfig> {
  // Normalize path for Windows (resolve handles mixed separators)
  const normalizedPath = resolve(localPath);
  const configPath = join(normalizedPath, "wp-config.php");

  // Verify file exists
  try {
    await access(configPath);
  } catch {
    throw new Error(`wp-config.php not found at: ${configPath}`);
  }

  const content = await readFile(configPath, "utf-8");

  function extractDefine(name: string): string {
    // Match: define('DB_NAME', 'value'); or define("DB_NAME", "value");
    const regex = new RegExp(
      `define\\s*\\(\\s*['"]${name}['"]\\s*,\\s*['"]([^'"]*)['"]\\s*\\)`,
      "i"
    );
    const match = content.match(regex);
    return match?.[1] || "";
  }

  function extractPrefix(): string {
    // Match: $table_prefix = 'wp_';
    const regex = /\$table_prefix\s*=\s*['"]([^'"]*)['"]/;
    const match = content.match(regex);
    return match?.[1] || "wp_";
  }

  const dbName = extractDefine("DB_NAME");
  const dbUser = extractDefine("DB_USER");
  const dbPassword = extractDefine("DB_PASSWORD");
  const dbHost = extractDefine("DB_HOST");

  if (!dbName || !dbUser) {
    throw new Error("Could not parse database credentials from wp-config.php");
  }

  return {
    host: dbHost || "localhost",
    user: dbUser,
    password: dbPassword,
    name: dbName,
    prefix: extractPrefix(),
  };
}

// ─── Page content analyzer ────────────────────────────────────────────

function analyzePage(
  postContent: string,
  postTitle: string,
  siteUrl: string,
  slug: string
): WPPageData {
  const $ = cheerio.load(postContent);
  const fullUrl = `${siteUrl.replace(/\/$/, "")}/${slug}/`;

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
    const format = extname(src).replace(".", "").toLowerCase() || "unknown";

    images.push({
      src,
      alt: alt && alt.trim() ? alt.trim() : null,
      size_kb: 0, // Will be estimated from file system if accessible
      format,
      lazy: loading === "lazy",
    });
  });

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  const siteDomain = new URL(siteUrl).hostname;

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

  // Word count (strip HTML)
  const textContent = $.text().replace(/\s+/g, " ").trim();
  const wordCount = textContent ? textContent.split(/\s+/).length : 0;

  // Schema markup (JSON-LD)
  let hasSchema = false;
  $('script[type="application/ld+json"]').each(() => {
    hasSchema = true;
  });

  // Open Graph
  const hasOgTags = !!($('meta[property="og:title"]').length || $('meta[property="og:description"]').length);

  // Meta description
  const metaDesc = $('meta[name="description"]').attr("content") || null;

  return {
    url: fullUrl,
    title: postTitle,
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

// ─── Image size estimation ────────────────────────────────────────────

async function estimateImageSize(localPath: string, src: string): Promise<number> {
  try {
    // Try to resolve relative image paths to local files
    if (src.startsWith("/")) {
      const filePath = join(localPath, src);
      const s = await stat(filePath);
      return Math.round(s.size / 1024);
    }
    // For wp-content uploads
    if (src.includes("/wp-content/")) {
      const relPath = src.split("/wp-content/")[1];
      if (relPath) {
        const filePath = join(localPath, "wp-content", relPath);
        const s = await stat(filePath);
        return Math.round(s.size / 1024);
      }
    }
  } catch {
    // File not found locally
  }
  return 0;
}

// ─── Main crawler ─────────────────────────────────────────────────────

/**
 * Crawl a local WordPress installation and extract SEO/performance data.
 */
export async function crawlWordPressSite(rawPath: string): Promise<WPCrawlResult> {
  // Normalize path for Windows (handles mixed separators, trailing slashes)
  const localPath = resolve(rawPath);

  // 1. Parse wp-config.php
  const dbConfig = await parseWPConfig(localPath);

  // 2. Connect to MySQL
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name,
    connectTimeout: 10000,
  });

  try {
    const prefix = dbConfig.prefix;

    // 3. Get site URL from wp_options
    const [siteUrlRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT option_value FROM ${prefix}options WHERE option_name = 'siteurl' LIMIT 1`
    );
    const siteUrl = siteUrlRows[0]?.option_value as string || "http://localhost";

    // 4. Get published pages/posts (limit MAX_PAGES)
    const [postRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT ID, post_title, post_name, post_content, post_type, post_date
       FROM ${prefix}posts
       WHERE post_status = 'publish'
         AND post_type IN ('post', 'page')
       ORDER BY post_date DESC
       LIMIT ?`,
      [MAX_PAGES]
    );

    // 5. Get post meta (for meta descriptions — Yoast, RankMath, AIOSEO)
    const postIds = postRows.map((r) => r.ID as number);
    let metaMap = new Map<number, string>();

    if (postIds.length > 0) {
      const placeholders = postIds.map(() => "?").join(",");
      const [metaRows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT post_id, meta_key, meta_value
         FROM ${prefix}postmeta
         WHERE post_id IN (${placeholders})
           AND meta_key IN ('_yoast_wpseo_metadesc', 'rank_math_description', '_aioseo_description', '_genesis_description')`,
        postIds
      );

      for (const row of metaRows) {
        const postId = row.post_id as number;
        const value = row.meta_value as string;
        if (value && !metaMap.has(postId)) {
          metaMap.set(postId, value);
        }
      }
    }

    // 6. Analyze each page
    const pages: WPPageData[] = [];
    let totalImages = 0;
    let missingAlt = 0;
    let missingMeta = 0;

    for (const post of postRows) {
      const postId = post.ID as number;
      const content = post.post_content as string || "";
      const title = post.post_title as string || "";
      const slug = post.post_name as string || "";

      const pageData = analyzePage(content, title, siteUrl, slug);

      // Override meta description from SEO plugin if available
      const seoMeta = metaMap.get(postId);
      if (seoMeta) {
        pageData.meta_description = seoMeta;
      }

      // Estimate image sizes
      for (const img of pageData.images) {
        const sizeKb = await estimateImageSize(localPath, img.src);
        img.size_kb = sizeKb;
      }

      totalImages += pageData.images.length;
      missingAlt += pageData.images.filter((img) => !img.alt).length;
      if (!pageData.meta_description) missingMeta++;

      pages.push(pageData);
    }

    // 7. Database stats
    const [revisionRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${prefix}posts WHERE post_type = 'revision'`
    );
    const revisions = (revisionRows[0]?.count as number) || 0;

    const [transientRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${prefix}options WHERE option_name LIKE '_transient_%'`
    );
    const transients = (transientRows[0]?.count as number) || 0;

    const [expiredTransientRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${prefix}options
       WHERE option_name LIKE '_transient_timeout_%'
         AND option_value < UNIX_TIMESTAMP()`
    );
    const expiredTransients = (expiredTransientRows[0]?.count as number) || 0;

    const [autoloadRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT SUM(LENGTH(option_value)) as total_bytes FROM ${prefix}options WHERE autoload = 'yes'`
    );
    const autoloadKb = Math.round(((autoloadRows[0]?.total_bytes as number) || 0) / 1024);

    const [spamRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${prefix}comments WHERE comment_approved = 'spam'`
    );
    const spamComments = (spamRows[0]?.count as number) || 0;

    // 8. Plugins
    const [pluginRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT option_value FROM ${prefix}options WHERE option_name = 'active_plugins' LIMIT 1`
    );
    const activePluginSlugs: string[] = [];
    try {
      const serialized = pluginRows[0]?.option_value as string || "";
      // PHP serialized array — extract plugin slugs
      const matches = serialized.matchAll(/s:\d+:"([^"]+)"/g);
      for (const m of matches) {
        if (m[1]) activePluginSlugs.push(m[1]);
      }
    } catch {
      // Failed to parse plugins
    }

    const plugins: WPPluginData[] = activePluginSlugs.map((slug) => {
      const parts = slug.split("/");
      const pluginDir = parts[0] || slug;
      return {
        name: pluginDir.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: pluginDir,
        version: "",
        active: true,
      };
    });

    // 9. Theme
    const [themeRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT option_name, option_value FROM ${prefix}options
       WHERE option_name IN ('template', 'stylesheet')
       LIMIT 2`
    );
    let themeName = "Unknown";
    for (const row of themeRows) {
      if (row.option_name === "stylesheet") {
        themeName = row.option_value as string;
      }
    }

    // 10. WordPress version
    let wpVersion = "Unknown";
    try {
      const versionFile = join(localPath, "wp-includes", "version.php");
      const versionContent = await readFile(versionFile, "utf-8");
      const vMatch = versionContent.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
      if (vMatch?.[1]) wpVersion = vMatch[1];
    } catch {
      // version.php not found
    }

    // 11. PHP version from wp-config or environment
    let phpVersion = "Unknown";
    try {
      const wpConfigContent = await readFile(join(localPath, "wp-config.php"), "utf-8");
      // Some configs have PHP version comments
      const phpMatch = wpConfigContent.match(/PHP\s*(\d+\.\d+)/i);
      if (phpMatch?.[1]) phpVersion = phpMatch[1];
    } catch {
      // Ignore
    }

    return {
      site_url: siteUrl,
      pages,
      total_pages: pages.length,
      total_images: totalImages,
      missing_alt: missingAlt,
      missing_meta: missingMeta,
      plugins,
      theme: {
        name: themeName,
        version: "",
      },
      database: {
        revisions,
        transients,
        expired_transients: expiredTransients,
        autoload_kb: autoloadKb,
        spam_comments: spamComments,
      },
      server: {
        php_version: phpVersion,
        wp_version: wpVersion,
      },
      crawled_at: new Date().toISOString(),
    };
  } finally {
    await connection.end();
  }
}
