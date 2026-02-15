/**
 * Claude API integration for WordPress site analysis.
 *
 * Takes WordPress crawl data + dashboard analytics and sends to Claude
 * for expert SEO, performance, and technical analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  WPCrawlResult,
  DashboardAnalyticsData,
  AnalysisResult,
  AIRecommendation,
  AnalysisScores,
} from "@/types/wordpress";

// ─── Claude client (singleton) ────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ─── System prompt ────────────────────────────────────────────────────

function getSystemPrompt(): string {
  return `You are an expert WordPress consultant with deep expertise in SEO, web performance, and technical optimization. You are analyzing a WordPress website for an agency that manages multiple client sites.

Your analysis must be:
- Specific and actionable (not generic advice)
- Based on the actual data provided (reference specific pages, images, plugins)
- Prioritized by impact (critical issues first)
- Practical (consider effort vs. impact)

You will receive:
1. WordPress site crawl data (pages, images, plugins, database stats)
2. Google Analytics (GA4) data (if available)
3. Google Search Console (GSC) data (if available)
4. Previous SEO audit and site check results (if available)

Respond ONLY with valid JSON in this exact format:
{
  "scores": {
    "seo": <0-100>,
    "performance": <0-100>,
    "technical": <0-100>,
    "overall": <0-100>
  },
  "recommendations": [
    {
      "id": "rec_1",
      "category": "seo|performance|technical|content",
      "priority": "critical|high|medium|low",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the issue and why it matters",
      "current": "What the current state is (be specific, reference actual data)",
      "ideal": "What it should be changed to",
      "impact": "Expected improvement if fixed",
      "effort": "quick|moderate|complex"
    }
  ],
  "summary": "2-3 sentence executive summary of the site's health",
  "total_issues": <number>
}

Score guidelines:
- 90-100: Excellent, minor tweaks only
- 70-89: Good, some improvements needed
- 50-69: Needs work, significant issues
- 0-49: Critical, major problems

Priority guidelines:
- critical: Directly hurting rankings or user experience NOW
- high: Will significantly improve results when fixed
- medium: Good practice, moderate impact
- low: Nice to have, minor improvement

Generate 8-15 specific recommendations. Always include at least one from each category (seo, performance, technical, content) if issues exist.`;
}

// ─── User prompt builder ──────────────────────────────────────────────

function buildUserPrompt(
  crawlData: WPCrawlResult,
  analyticsData?: DashboardAnalyticsData
): string {
  const sections: string[] = [];

  // ─── WordPress Site Data ────────────────────────────────────────
  sections.push("## WordPress Site Analysis Data");
  sections.push(`**Site URL:** ${crawlData.site_url}`);
  sections.push(`**WordPress Version:** ${crawlData.server.wp_version}`);
  sections.push(`**Theme:** ${crawlData.theme.name}`);
  sections.push(`**Total Pages Crawled:** ${crawlData.total_pages}`);
  sections.push(`**Total Images:** ${crawlData.total_images}`);
  sections.push(`**Images Missing Alt Text:** ${crawlData.missing_alt} of ${crawlData.total_images}`);
  sections.push(`**Pages Missing Meta Description:** ${crawlData.missing_meta} of ${crawlData.total_pages}`);

  // Active plugins with asset analysis
  const totalPluginJs = crawlData.plugins.reduce((s, p) => s + (p.total_js_kb || 0), 0);
  const totalPluginCss = crawlData.plugins.reduce((s, p) => s + (p.total_css_kb || 0), 0);
  sections.push(`\n### Active Plugins (${crawlData.plugins.length}) — Total JS: ${totalPluginJs}KB, CSS: ${totalPluginCss}KB`);
  for (const plugin of crawlData.plugins) {
    const assetInfo = plugin.assets && plugin.assets.length > 0
      ? ` | JS: ${plugin.total_js_kb || 0}KB, CSS: ${plugin.total_css_kb || 0}KB | Loads: ${plugin.loads_on || "all"}`
      : "";
    sections.push(`- ${plugin.name} (${plugin.slug})${assetInfo}`);
    if (plugin.assets) {
      for (const asset of plugin.assets) {
        sections.push(`    ${asset.type.toUpperCase()}: ${asset.handle} → ${asset.src}${asset.size_kb > 0 ? ` (${asset.size_kb}KB)` : ""}`);
      }
    }
  }

  // Database health
  sections.push("\n### Database Health");
  sections.push(`- Post revisions: ${crawlData.database.revisions}`);
  sections.push(`- Transients: ${crawlData.database.transients} (${crawlData.database.expired_transients} expired)`);
  sections.push(`- Autoloaded options: ${crawlData.database.autoload_kb} KB`);
  sections.push(`- Spam comments: ${crawlData.database.spam_comments}`);

  // Page details (summarize to keep token count reasonable)
  sections.push(`\n### Page Analysis (${crawlData.pages.length} pages)`);

  // Pages with issues
  const noMeta = crawlData.pages.filter((p) => !p.meta_description);
  if (noMeta.length > 0) {
    sections.push(`\n**Pages without meta description (${noMeta.length}):**`);
    for (const p of noMeta.slice(0, 15)) {
      sections.push(`- ${p.title} (${p.url})`);
    }
    if (noMeta.length > 15) sections.push(`  ...and ${noMeta.length - 15} more`);
  }

  const noH1 = crawlData.pages.filter((p) => p.h1.length === 0);
  const multiH1 = crawlData.pages.filter((p) => p.h1.length > 1);
  if (noH1.length > 0) {
    sections.push(`\n**Pages without H1 (${noH1.length}):**`);
    for (const p of noH1.slice(0, 10)) {
      sections.push(`- ${p.title} (${p.url})`);
    }
  }
  if (multiH1.length > 0) {
    sections.push(`\n**Pages with multiple H1 tags (${multiH1.length}):**`);
    for (const p of multiH1.slice(0, 10)) {
      sections.push(`- ${p.title}: ${p.h1.length} H1 tags (${p.url})`);
    }
  }

  // Thin content
  const thinPages = crawlData.pages.filter((p) => p.word_count < 300);
  if (thinPages.length > 0) {
    sections.push(`\n**Thin content pages (<300 words): ${thinPages.length}**`);
    for (const p of thinPages.slice(0, 10)) {
      sections.push(`- ${p.title}: ${p.word_count} words (${p.url})`);
    }
  }

  // Images without alt text
  const pagesWithMissingAlt = crawlData.pages.filter(
    (p) => p.images.some((img) => !img.alt)
  );
  if (pagesWithMissingAlt.length > 0) {
    sections.push(`\n**Pages with images missing alt text (${pagesWithMissingAlt.length}):**`);
    for (const p of pagesWithMissingAlt.slice(0, 10)) {
      const missing = p.images.filter((img) => !img.alt).length;
      sections.push(`- ${p.title}: ${missing} images without alt (${p.url})`);
    }
  }

  // Schema & OG coverage
  const noSchema = crawlData.pages.filter((p) => !p.has_schema);
  const noOg = crawlData.pages.filter((p) => !p.has_og_tags);
  sections.push(`\n**Schema markup:** ${crawlData.pages.length - noSchema.length}/${crawlData.pages.length} pages have schema`);
  sections.push(`**Open Graph tags:** ${crawlData.pages.length - noOg.length}/${crawlData.pages.length} pages have OG tags`);

  // Large images
  const largeImages = crawlData.pages.flatMap((p) =>
    p.images.filter((img) => img.size_kb > 200).map((img) => ({ ...img, page: p.title }))
  );
  if (largeImages.length > 0) {
    sections.push(`\n**Large images (>200KB): ${largeImages.length}**`);
    for (const img of largeImages.slice(0, 10)) {
      sections.push(`- ${img.page}: ${img.src} (${img.size_kb}KB, ${img.format})`);
    }
  }

  // Non-lazy images
  const nonLazy = crawlData.pages.flatMap((p) =>
    p.images.filter((img) => !img.lazy)
  );
  if (nonLazy.length > 0) {
    sections.push(`\n**Images without lazy loading:** ${nonLazy.length} of ${crawlData.total_images}`);
  }

  // ─── Google Analytics Data ──────────────────────────────────────
  if (analyticsData?.ga4) {
    const ga4 = analyticsData.ga4;
    sections.push("\n## Google Analytics (GA4) Data");
    sections.push(`- Sessions: ${ga4.sessions}`);
    sections.push(`- Users: ${ga4.users}`);
    sections.push(`- Pageviews: ${ga4.pageviews}`);
    sections.push(`- Bounce rate: ${ga4.bounce_rate}%`);
    sections.push(`- Avg session duration: ${ga4.avg_session_duration}s`);

    if (ga4.top_pages.length > 0) {
      sections.push("\n**Top Pages:**");
      for (const p of ga4.top_pages.slice(0, 10)) {
        sections.push(`- ${p.page}: ${p.views} views`);
      }
    }

    if (ga4.traffic_sources.length > 0) {
      sections.push("\n**Traffic Sources:**");
      for (const s of ga4.traffic_sources) {
        sections.push(`- ${s.source}: ${s.sessions} sessions`);
      }
    }
  }

  // ─── Google Search Console Data ─────────────────────────────────
  if (analyticsData?.gsc) {
    const gsc = analyticsData.gsc;
    sections.push("\n## Google Search Console Data");
    sections.push(`- Total clicks: ${gsc.clicks}`);
    sections.push(`- Total impressions: ${gsc.impressions}`);
    sections.push(`- Average CTR: ${(gsc.ctr * 100).toFixed(1)}%`);
    sections.push(`- Average position: ${gsc.position.toFixed(1)}`);

    if (gsc.top_queries.length > 0) {
      sections.push("\n**Top Search Queries:**");
      for (const q of gsc.top_queries.slice(0, 15)) {
        sections.push(`- "${q.query}": ${q.clicks} clicks, ${q.impressions} imp, CTR ${(q.ctr * 100).toFixed(1)}%, pos ${q.position.toFixed(1)}`);
      }
    }

    if (gsc.top_pages.length > 0) {
      sections.push("\n**Top Pages in Search:**");
      for (const p of gsc.top_pages.slice(0, 10)) {
        sections.push(`- ${p.page}: ${p.clicks} clicks, ${p.impressions} imp`);
      }
    }
  }

  // ─── Previous SEO Audit ─────────────────────────────────────────
  if (analyticsData?.seo_audit) {
    sections.push("\n## Previous SEO Audit Results");
    sections.push(`**Score:** ${analyticsData.seo_audit.score}/100`);
    for (const check of analyticsData.seo_audit.checks) {
      sections.push(`- ${check.name}: ${check.status}${check.details ? ` — ${check.details}` : ""}`);
    }
  }

  // ─── Broken Links ───────────────────────────────────────────────
  if (analyticsData?.broken_links && analyticsData.broken_links.broken > 0) {
    sections.push("\n## Broken Links");
    sections.push(`**${analyticsData.broken_links.broken} broken out of ${analyticsData.broken_links.total} links**`);
    for (const link of analyticsData.broken_links.links.slice(0, 10)) {
      sections.push(`- ${link.url} (status: ${link.status})`);
    }
  }

  // ─── Uptime / Performance ──────────────────────────────────────
  if (analyticsData?.uptime) {
    sections.push("\n## Site Performance");
    sections.push(`- Response time: ${analyticsData.uptime.response_time_ms}ms`);
    sections.push(`- Page size: ${analyticsData.uptime.page_size_kb}KB`);
    sections.push(`- SSL: ${analyticsData.uptime.has_ssl ? "Yes" : "No"}`);
    sections.push(`- Compression: ${analyticsData.uptime.has_compression ? "Enabled" : "Disabled"}`);
  }

  sections.push("\n---\nAnalyze the above data and provide your expert recommendations in the specified JSON format.");

  return sections.join("\n");
}

// ─── Main analysis function ───────────────────────────────────────────

/**
 * Send WordPress crawl data + analytics to Claude for analysis.
 * Returns structured recommendations with scores.
 */
export async function analyzeWithClaude(
  crawlData: WPCrawlResult,
  analyticsData?: DashboardAnalyticsData
): Promise<{ result: AnalysisResult; tokensUsed: number }> {
  const client = getClient();
  const userPrompt = buildUserPrompt(crawlData, analyticsData);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: getSystemPrompt(),
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  // Calculate tokens used
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  // Extract text response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse JSON from response (handle potential ```json wrapper)
  let jsonStr = textBlock.text.trim();

  // Remove markdown code block wrapper if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: {
    scores?: AnalysisScores;
    recommendations?: AIRecommendation[];
    summary?: string;
    total_issues?: number;
  };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse Claude response as JSON:", jsonStr.slice(0, 500));
    throw new Error("Failed to parse AI response. The model returned invalid JSON.");
  }

  // Validate structure
  const scores: AnalysisScores = {
    seo: Math.max(0, Math.min(100, parsed.scores?.seo || 0)),
    performance: Math.max(0, Math.min(100, parsed.scores?.performance || 0)),
    technical: Math.max(0, Math.min(100, parsed.scores?.technical || 0)),
    overall: Math.max(0, Math.min(100, parsed.scores?.overall || 0)),
  };

  const recommendations: AIRecommendation[] = (parsed.recommendations || []).map(
    (rec, i) => ({
      id: rec.id || `rec_${i + 1}`,
      category: rec.category || "technical",
      priority: rec.priority || "medium",
      title: rec.title || "Untitled recommendation",
      description: rec.description || "",
      current: rec.current || "",
      ideal: rec.ideal || "",
      impact: rec.impact || "",
      effort: rec.effort || "moderate",
    })
  );

  const result: AnalysisResult = {
    scores,
    recommendations,
    summary: parsed.summary || "Analysis complete.",
    total_issues: parsed.total_issues || recommendations.length,
  };

  return { result, tokensUsed };
}
