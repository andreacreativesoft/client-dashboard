/**
 * WordPress site crawler.
 *
 * Reads wp-config.php to get database credentials, connects to MySQL,
 * and extracts SEO-relevant data from all published pages/posts.
 *
 * Designed to run on the server (Node.js) against local WordPress installations.
 */

import { readFile, access, stat, readdir } from "fs/promises";
import { join, extname, resolve } from "path";
import mysql from "mysql2/promise";
import * as cheerio from "cheerio";
import type {
  WPCrawlResult,
  WPPageData,
  WPImageData,
  WPPluginData,
  WPPluginAsset,
} from "@/types/wordpress";

// ─── Constants ────────────────────────────────────────────────────────

const MAX_PAGES = 100;

// ─── wp-config.php parser ─────────────────────────────────────────────

interface WPDBConfig {
  host: string;
  port?: number;
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

  // Detect Local by Flywheel MySQL port
  let port: number | undefined;
  try {
    const localSitesJson = join(
      process.env.APPDATA || process.env.HOME || "",
      "Local",
      "sites.json"
    );
    const sitesRaw = await readFile(localSitesJson, "utf-8");
    const sites = JSON.parse(sitesRaw) as Record<string, {
      path?: string;
      services?: {
        mysql?: {
          ports?: { MYSQL?: number[] };
        };
      };
    }>;

    // Find the site whose path matches our localPath
    const normalizedLocal = resolve(localPath).toLowerCase().replace(/\\/g, "/");
    for (const site of Object.values(sites)) {
      const sitePath = (site.path || "").toLowerCase().replace(/\\/g, "/");
      if (normalizedLocal.startsWith(sitePath)) {
        const mysqlPorts = site.services?.mysql?.ports?.MYSQL;
        if (mysqlPorts && mysqlPorts.length > 0) {
          port = mysqlPorts[0];
        }
        break;
      }
    }
  } catch {
    // Not Local by Flywheel or sites.json not found — use default port
  }

  console.log("[WP Crawler] DB config — host:", dbHost, "port:", port, "user:", dbUser, "db:", dbName);

  return {
    host: dbHost || "localhost",
    port,
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

// ─── Plugin asset analyzer ───────────────────────────────────────────

/**
 * Scan a plugin's PHP files to find enqueued JS/CSS and where they load.
 * Looks for wp_enqueue_script, wp_enqueue_style, wp_register_script, wp_register_style.
 */
async function analyzePluginAssets(
  pluginsDir: string,
  pluginSlug: string,
  localPath: string
): Promise<{ assets: WPPluginAsset[]; loadsOn: "all" | "frontend" | "admin" | "specific" }> {
  const assets: WPPluginAsset[] = [];
  let loadsOn: "all" | "frontend" | "admin" | "specific" = "all";

  const pluginDir = join(pluginsDir, pluginSlug);

  try {
    await access(pluginDir);
  } catch {
    return { assets, loadsOn };
  }

  // Collect all PHP files in plugin dir (max 2 levels deep)
  const phpFiles: string[] = [];
  try {
    const entries = await readdir(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".php")) {
        phpFiles.push(join(pluginDir, entry.name));
      } else if (entry.isDirectory()) {
        try {
          const subEntries = await readdir(join(pluginDir, entry.name), { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isFile() && sub.name.endsWith(".php")) {
              phpFiles.push(join(pluginDir, entry.name, sub.name));
            }
          }
        } catch {
          // Skip unreadable subdirectories
        }
      }
    }
  } catch {
    return { assets, loadsOn };
  }

  // Track loading context
  let hasAdminOnly = false;
  let hasFrontendOnly = false;
  let hasGlobalLoad = false;

  for (const filePath of phpFiles.slice(0, 30)) {
    try {
      const content = await readFile(filePath, "utf-8");

      // Detect loading context from hooks
      if (content.includes("is_admin()") || content.includes("admin_enqueue_scripts")) {
        hasAdminOnly = true;
      }
      if (content.includes("wp_enqueue_scripts") && !content.includes("admin_enqueue_scripts")) {
        hasFrontendOnly = true;
      }
      if (content.includes("wp_enqueue_scripts") && content.includes("admin_enqueue_scripts")) {
        hasGlobalLoad = true;
      }

      // Find enqueued scripts
      const scriptMatches = content.matchAll(
        /wp_(?:enqueue|register)_script\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g
      );
      for (const m of scriptMatches) {
        const handle = m[1] || "";
        let src = m[2] || "";

        // Skip empty or inline
        if (!src || src === "false") continue;

        // Resolve plugin-relative paths
        if (src.includes("plugins_url") || src.includes("plugin_dir_url")) {
          // Extract the relative file path from the function call
          const relMatch = src.match(/['"]([^'"]+\.js)['"]/);
          if (relMatch?.[1]) src = relMatch[1];
        }

        // Try to get file size
        let sizeKb = 0;
        try {
          const jsFileName = src.split("/").pop() || "";
          // Search common locations
          for (const subDir of ["js", "assets", "assets/js", "dist", "build", ""]) {
            try {
              const fullPath = join(pluginDir, subDir, jsFileName);
              const s = await stat(fullPath);
              sizeKb = Math.round(s.size / 1024);
              break;
            } catch {
              // Try next
            }
          }
        } catch {
          // Ignore
        }

        assets.push({ handle, src, type: "js", size_kb: sizeKb });
      }

      // Find enqueued styles
      const styleMatches = content.matchAll(
        /wp_(?:enqueue|register)_style\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g
      );
      for (const m of styleMatches) {
        const handle = m[1] || "";
        let src = m[2] || "";

        if (!src || src === "false") continue;

        if (src.includes("plugins_url") || src.includes("plugin_dir_url")) {
          const relMatch = src.match(/['"]([^'"]+\.css)['"]/);
          if (relMatch?.[1]) src = relMatch[1];
        }

        let sizeKb = 0;
        try {
          const cssFileName = src.split("/").pop() || "";
          for (const subDir of ["css", "assets", "assets/css", "dist", "build", ""]) {
            try {
              const fullPath = join(pluginDir, subDir, cssFileName);
              const s = await stat(fullPath);
              sizeKb = Math.round(s.size / 1024);
              break;
            } catch {
              // Try next
            }
          }
        } catch {
          // Ignore
        }

        assets.push({ handle, src, type: "css", size_kb: sizeKb });
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Determine load context
  if (hasGlobalLoad) {
    loadsOn = "all";
  } else if (hasAdminOnly && !hasFrontendOnly) {
    loadsOn = "admin";
  } else if (hasFrontendOnly && !hasAdminOnly) {
    loadsOn = "frontend";
  } else if (hasAdminOnly && hasFrontendOnly) {
    loadsOn = "all";
  }

  return { assets, loadsOn };
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
    port: dbConfig.port || 3306,
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

    // Analyze each plugin's assets and loading context
    const pluginsDir = join(localPath, "wp-content", "plugins");
    const plugins: WPPluginData[] = [];

    for (const slug of activePluginSlugs) {
      const parts = slug.split("/");
      const pluginDir = parts[0] || slug;

      const { assets, loadsOn } = await analyzePluginAssets(pluginsDir, pluginDir, localPath);

      const totalJsKb = assets
        .filter((a) => a.type === "js")
        .reduce((sum, a) => sum + a.size_kb, 0);
      const totalCssKb = assets
        .filter((a) => a.type === "css")
        .reduce((sum, a) => sum + a.size_kb, 0);

      plugins.push({
        name: pluginDir.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: pluginDir,
        version: "",
        active: true,
        loads_on: loadsOn,
        assets,
        total_js_kb: totalJsKb,
        total_css_kb: totalCssKb,
      });
    }

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
