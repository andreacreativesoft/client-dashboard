"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { crawlWordPressSite } from "@/lib/wordpress/crawler";
import { analyzeWithClaude } from "@/lib/wordpress/ai-analyzer";
import type {
  WPSiteConfig,
  WPAnalysis,
  WPCrawlResult,
  AnalysisScores,
  DashboardAnalyticsData,
} from "@/types/wordpress";

// ─── Types ────────────────────────────────────────────────────────────

export type AnalyzeResult = {
  success: boolean;
  error?: string;
  analysisId?: string;
  scores?: AnalysisScores;
};

export type ConfigResult = {
  success: boolean;
  error?: string;
  config?: WPSiteConfig;
};

export type AnalysisData = {
  success: boolean;
  error?: string;
  analysis?: WPAnalysis;
};

// ─── Get website config ──────────────────────────────────────────────

/**
 * Get the WordPress local path config for a website.
 */
export async function getWebsiteConfig(
  websiteId: string
): Promise<ConfigResult> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("wp_site_configs")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching WP config:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    config: (data as WPSiteConfig) ?? undefined,
  };
}

// ─── Save website config ─────────────────────────────────────────────

/**
 * Create or update the WordPress local path config for a website.
 */
export async function saveWebsiteConfig(
  websiteId: string,
  localPath: string,
  deployMethod: "none" | "git" | "wp_migrate" = "none"
): Promise<ConfigResult> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  // Validate path (basic check)
  if (!localPath.trim()) {
    return { success: false, error: "Local path is required" };
  }

  const supabase = createAdminClient();

  // Check if config already exists
  const { data: existing } = await supabase
    .from("wp_site_configs")
    .select("id")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("wp_site_configs")
      .update({
        local_path: localPath.trim(),
        deploy_method: deployMethod,
      })
      .eq("website_id", websiteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating WP config:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/websites/${websiteId}`);
    return { success: true, config: data as WPSiteConfig };
  } else {
    // Create new
    const { data, error } = await supabase
      .from("wp_site_configs")
      .insert({
        website_id: websiteId,
        local_path: localPath.trim(),
        deploy_method: deployMethod,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating WP config:", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/websites/${websiteId}`);
    return { success: true, config: data as WPSiteConfig };
  }
}

// ─── Get latest analysis ─────────────────────────────────────────────

/**
 * Get the most recent analysis for a website.
 */
export async function getLatestAnalysis(
  websiteId: string
): Promise<AnalysisData> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("wp_analyses")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching analysis:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    analysis: data as WPAnalysis | undefined,
  };
}

// ─── Get analysis by ID ──────────────────────────────────────────────

/**
 * Get a specific analysis by ID (for polling).
 */
export async function getAnalysisById(
  analysisId: string
): Promise<AnalysisData> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("wp_analyses")
    .select("*")
    .eq("id", analysisId)
    .single();

  if (error) {
    console.error("Error fetching analysis by ID:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    analysis: data as WPAnalysis,
  };
}

// ─── Gather dashboard analytics ──────────────────────────────────────

/**
 * Collect existing analytics data from the dashboard for a website/client.
 * This enriches the Claude prompt with GA4, GSC, SEO audit, etc.
 */
async function gatherDashboardAnalytics(
  websiteId: string,
  clientId: string
): Promise<DashboardAnalyticsData> {
  const supabase = createAdminClient();
  const analytics: DashboardAnalyticsData = {};

  try {
    // Get GA4 cached data
    const { data: ga4Cache } = await supabase
      .from("analytics_cache")
      .select("data")
      .eq("client_id", clientId)
      .eq("integration_type", "ga4")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    if (ga4Cache?.data) {
      const ga4 = ga4Cache.data as Record<string, unknown>;
      const overview = ga4.overview as Record<string, number> | undefined;
      const topPages = ga4.topPages as Array<Record<string, unknown>> | undefined;
      const trafficSources = ga4.trafficSources as Array<Record<string, unknown>> | undefined;

      if (overview) {
        analytics.ga4 = {
          sessions: overview.sessions || 0,
          users: overview.totalUsers || 0,
          pageviews: overview.pageViews || 0,
          bounce_rate: overview.bounceRate || 0,
          avg_session_duration: overview.avgSessionDuration || 0,
          top_pages: (topPages || []).slice(0, 10).map((p) => ({
            page: String(p.pagePath || ""),
            views: Number(p.pageViews || 0),
          })),
          traffic_sources: (trafficSources || []).slice(0, 10).map((s) => ({
            source: String(s.channel || ""),
            sessions: Number(s.sessions || 0),
          })),
        };
      }
    }

    // Get GSC cached data
    const { data: gscCache } = await supabase
      .from("analytics_cache")
      .select("data")
      .eq("client_id", clientId)
      .eq("integration_type", "gsc")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    if (gscCache?.data) {
      const gsc = gscCache.data as Record<string, unknown>;
      const overview = gsc.overview as Record<string, number> | undefined;
      const topQueries = gsc.topQueries as Array<Record<string, unknown>> | undefined;
      const topPages = gsc.topPages as Array<Record<string, unknown>> | undefined;

      if (overview) {
        analytics.gsc = {
          clicks: overview.totalClicks || 0,
          impressions: overview.totalImpressions || 0,
          ctr: overview.averageCTR || 0,
          position: overview.averagePosition || 0,
          top_queries: (topQueries || []).slice(0, 15).map((q) => ({
            query: String(q.query || ""),
            clicks: Number(q.clicks || 0),
            impressions: Number(q.impressions || 0),
            ctr: Number(q.ctr || 0),
            position: Number(q.position || 0),
          })),
          top_pages: (topPages || []).slice(0, 10).map((p) => ({
            page: String(p.page || ""),
            clicks: Number(p.clicks || 0),
            impressions: Number(p.impressions || 0),
          })),
        };
      }
    }

    // Get latest SEO audit
    const { data: seoCheck } = await supabase
      .from("site_checks")
      .select("score, summary, results")
      .eq("website_id", websiteId)
      .eq("check_type", "seo_audit")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (seoCheck) {
      analytics.seo_audit = {
        score: seoCheck.score || 0,
        checks: (seoCheck.results || []).map((r: Record<string, unknown>) => ({
          name: String(r.name || r.check || ""),
          status: String(r.status || r.result || ""),
          details: r.details ? String(r.details) : undefined,
        })),
      };
    }

    // Get latest broken links check
    const { data: brokenCheck } = await supabase
      .from("site_checks")
      .select("summary, results")
      .eq("website_id", websiteId)
      .eq("check_type", "broken_links")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (brokenCheck) {
      const summary = brokenCheck.summary as Record<string, unknown>;
      const brokenLinks = (brokenCheck.results || []).filter(
        (r: Record<string, unknown>) => r.status && Number(r.status) >= 400
      );
      analytics.broken_links = {
        total: Number(summary.total_links || summary.total || 0),
        broken: brokenLinks.length,
        links: brokenLinks.slice(0, 10).map((r: Record<string, unknown>) => ({
          url: String(r.url || ""),
          status: Number(r.status || 0),
        })),
      };
    }

    // Get latest uptime check
    const { data: uptimeCheck } = await supabase
      .from("site_checks")
      .select("summary")
      .eq("website_id", websiteId)
      .eq("check_type", "uptime")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (uptimeCheck) {
      const summary = uptimeCheck.summary as Record<string, unknown>;
      analytics.uptime = {
        response_time_ms: Number(summary.response_time_ms || summary.responseTime || 0),
        page_size_kb: Number(summary.page_size_kb || summary.pageSize || 0),
        has_ssl: Boolean(summary.has_ssl ?? summary.ssl ?? false),
        has_compression: Boolean(summary.has_compression ?? summary.compression ?? false),
      };
    }
  } catch (err) {
    console.error("Error gathering dashboard analytics:", err);
    // Non-fatal: we can still run analysis without analytics enrichment
  }

  return analytics;
}

// ─── Cancel analysis ─────────────────────────────────────────────────

/**
 * Cancel a running analysis by marking it as failed/cancelled.
 */
export async function cancelAnalysis(
  analysisId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("wp_analyses")
    .select("status")
    .eq("id", analysisId)
    .single();

  if (!existing) {
    return { success: false, error: "Analysis not found" };
  }

  if (existing.status !== "running") {
    return { success: false, error: "Analysis is not running" };
  }

  await supabase
    .from("wp_analyses")
    .update({
      status: "failed",
      error_message: "Cancelled by user",
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  return { success: true };
}

// ─── Main analysis action ────────────────────────────────────────────

/**
 * Run a full WordPress site analysis:
 * 1. Crawl the local WordPress installation
 * 2. Gather dashboard analytics (GA4, GSC, SEO audit, etc.)
 * 3. Send everything to Claude for analysis
 * 4. Store results in database
 *
 * The server action awaits the pipeline (needed for Vercel serverless).
 * The UI polls via getAnalysisById for progress and can cancel via cancelAnalysis.
 */
export async function analyzeWebsite(
  websiteId: string
): Promise<AnalyzeResult> {
  const auth = await requireAdmin();
  if (!auth.success) return { success: false, error: auth.error };

  const supabase = createAdminClient();

  // 1. Get website + config
  const { data: website } = await supabase
    .from("websites")
    .select("id, client_id, name, url")
    .eq("id", websiteId)
    .single();

  if (!website) {
    return { success: false, error: "Website not found" };
  }

  const { data: config } = await supabase
    .from("wp_site_configs")
    .select("local_path")
    .eq("website_id", websiteId)
    .single();

  if (!config?.local_path) {
    return {
      success: false,
      error: "WordPress local path not configured. Please set the local path first.",
    };
  }

  // Detect Vercel/serverless environment — local file access is not available
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      success: false,
      error: "AI Analysis requires access to the local WordPress filesystem. Please run this from your local development server (localhost:3000), not from the deployed Vercel instance.",
    };
  }

  // 2. Create analysis record (status: running)
  const { data: analysis, error: insertError } = await supabase
    .from("wp_analyses")
    .insert({
      website_id: websiteId,
      client_id: website.client_id,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !analysis) {
    console.error("Error creating analysis record:", insertError);
    return { success: false, error: "Failed to start analysis" };
  }

  const analysisId = analysis.id as string;

  // 3. Run the full analysis pipeline (awaited — server action stays alive)
  // The pipeline checks for cancellation at key checkpoints.
  await runAnalysisPipeline(analysisId, websiteId, website.client_id, config.local_path);

  return {
    success: true,
    analysisId,
  };
}

// ─── Cancellation check helper ──────────────────────────────────────

/**
 * Check if an analysis has been cancelled (status changed to "failed" with
 * "Cancelled by user" message). Throws if cancelled.
 */
async function checkCancelled(analysisId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("wp_analyses")
    .select("status")
    .eq("id", analysisId)
    .single();

  if (data?.status !== "running") {
    throw new Error("Analysis was cancelled");
  }
}

// ─── Analysis pipeline ──────────────────────────────────────────────

const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute hard timeout

async function runAnalysisPipeline(
  analysisId: string,
  websiteId: string,
  clientId: string,
  localPath: string
): Promise<void> {
  const supabase = createAdminClient();

  // Wrap the entire pipeline in a timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Analysis timed out after 5 minutes")), PIPELINE_TIMEOUT_MS);
  });

  try {
    await Promise.race([
      (async () => {
        // Step 1: Crawl WordPress site
        const crawlData: WPCrawlResult = await crawlWordPressSite(localPath);

        // Check if user cancelled between steps
        await checkCancelled(analysisId);

        // Step 2: Gather dashboard analytics
        const analyticsData = await gatherDashboardAnalytics(websiteId, clientId);

        // Check again before the expensive Claude call
        await checkCancelled(analysisId);

        // Step 3: Send to Claude for analysis
        const { result, tokensUsed } = await analyzeWithClaude(crawlData, analyticsData);

        // Final check before writing results
        await checkCancelled(analysisId);

        // Step 4: Update analysis record with results
        await supabase
          .from("wp_analyses")
          .update({
            status: "completed",
            site_data: crawlData as unknown as Record<string, unknown>,
            recommendations: result.recommendations as unknown as Record<string, unknown>[],
            scores: result.scores as unknown as Record<string, unknown>,
            pages_analyzed: crawlData.total_pages,
            issues_found: result.total_issues,
            claude_tokens: tokensUsed,
            summary: result.summary,
            completed_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        revalidatePath(`/admin/websites/${websiteId}`);
      })(),
      timeoutPromise,
    ]);
  } catch (err) {
    // Extract error message — handle non-Error objects
    let errorMessage: string;
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === "string") {
      errorMessage = err;
    } else {
      errorMessage = JSON.stringify(err) || "Unknown error during analysis";
    }

    // Don't overwrite a user-initiated cancel
    if (errorMessage === "Analysis was cancelled") {
      return;
    }

    console.error("Analysis pipeline failed:", errorMessage);
    console.error("Raw error:", err);

    // Update record with failure
    await supabase
      .from("wp_analyses")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
  }
}
