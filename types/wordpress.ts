// ─── WordPress Page Data ──────────────────────────────────────────────

export interface WPPageData {
  url: string;
  title: string;
  meta_description: string | null;
  h1: string[];
  h2_count: number;
  h3_count: number;
  word_count: number;
  images: WPImageData[];
  has_schema: boolean;
  has_og_tags: boolean;
  internal_links: number;
  external_links: number;
}

export interface WPImageData {
  src: string;
  alt: string | null;
  size_kb: number;
  format: string;
  lazy: boolean;
}

// ─── WordPress Crawl Result ──────────────────────────────────────────

export interface WPCrawlResult {
  site_url: string;
  pages: WPPageData[];
  total_pages: number;
  total_images: number;
  missing_alt: number;
  missing_meta: number;
  plugins: WPPluginData[];
  theme: {
    name: string;
    version: string;
  };
  database: {
    revisions: number;
    transients: number;
    expired_transients: number;
    autoload_kb: number;
    spam_comments: number;
  };
  server: {
    php_version: string;
    wp_version: string;
  };
  crawled_at: string;
}

export interface WPPluginData {
  name: string;
  slug: string;
  version: string;
  active: boolean;
}

// ─── AI Analysis Types ───────────────────────────────────────────────

export type RecommendationCategory = "seo" | "performance" | "technical" | "content";
export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationEffort = "quick" | "moderate" | "complex";

export interface AIRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  current: string;
  ideal: string;
  impact: string;
  effort: RecommendationEffort;
}

export interface AnalysisScores {
  seo: number;
  performance: number;
  technical: number;
  overall: number;
}

export interface AnalysisResult {
  scores: AnalysisScores;
  recommendations: AIRecommendation[];
  summary: string;
  total_issues: number;
}

// ─── Dashboard Analytics Data (passed to Claude) ─────────────────────

export interface DashboardAnalyticsData {
  ga4?: {
    sessions: number;
    users: number;
    pageviews: number;
    bounce_rate: number;
    avg_session_duration: number;
    top_pages: Array<{ page: string; views: number }>;
    traffic_sources: Array<{ source: string; sessions: number }>;
  };
  gsc?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    top_queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    top_pages: Array<{ page: string; clicks: number; impressions: number }>;
  };
  seo_audit?: {
    score: number;
    checks: Array<{ name: string; status: string; details?: string }>;
  };
  broken_links?: {
    total: number;
    broken: number;
    links: Array<{ url: string; status: number }>;
  };
  uptime?: {
    response_time_ms: number;
    page_size_kb: number;
    has_ssl: boolean;
    has_compression: boolean;
  };
}

// ─── Database Row Types ──────────────────────────────────────────────

export interface WPSiteConfig {
  id: string;
  website_id: string;
  local_path: string;
  deploy_method: "none" | "git" | "wp_migrate";
  created_at: string;
  updated_at: string;
}

export interface WPAnalysis {
  id: string;
  website_id: string;
  client_id: string;
  status: "running" | "completed" | "failed";
  site_data: WPCrawlResult | Record<string, unknown>;
  recommendations: AIRecommendation[];
  scores: AnalysisScores | Record<string, unknown>;
  pages_analyzed: number;
  issues_found: number;
  claude_tokens: number;
  summary: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}
