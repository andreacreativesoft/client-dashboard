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

export interface WPPluginAsset {
  handle: string;
  src: string;
  type: "js" | "css";
  size_kb: number;
}

export interface WPPluginData {
  name: string;
  slug: string;
  version: string;
  active: boolean;
  loads_on: "all" | "frontend" | "admin" | "specific";
  assets: WPPluginAsset[];
  total_js_kb: number;
  total_css_kb: number;
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

export type AnalysisMode = "online" | "local";

export interface WPSiteConfig {
  id: string;
  website_id: string;
  local_path: string;
  deploy_method: "none" | "git" | "wp_migrate";
  analysis_mode: AnalysisMode;
  created_at: string;
  updated_at: string;
}

export interface WPAnalysis {
  id: string;
  website_id: string;
  client_id: string;
  status: "running" | "completed" | "failed";
  analysis_mode: AnalysisMode;
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

// ─── WordPress Credential Types ──────────────────────────────────────

export interface WordPressCredentials {
  id: string;
  integration_id: string;
  site_url: string;
  username: string;
  app_password: string;
  shared_secret: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_key?: string;
  ssh_port: number;
  mu_plugin_installed: boolean;
  mu_plugin_version?: string;
  last_health_check?: string;
  last_health_status?: SiteHealthData;
}

export interface WordPressCredentialsEncrypted {
  id: string;
  integration_id: string;
  site_url: string;
  username_encrypted: string;
  app_password_encrypted: string;
  shared_secret_encrypted: string;
  ssh_host_encrypted?: string | null;
  ssh_user_encrypted?: string | null;
  ssh_key_encrypted?: string | null;
  ssh_port: number;
  mu_plugin_installed: boolean;
  mu_plugin_version?: string | null;
  last_health_check?: string | null;
  last_health_status?: SiteHealthData | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectWordPressInput {
  website_id: string;
  site_url: string;
  username: string;
  app_password: string;
  shared_secret?: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_key?: string;
  ssh_port?: number;
}

// ─── Site Health Types ───────────────────────────────────────────────

export interface SiteHealthData {
  wp_version: string;
  php_version: string;
  server_software: string;
  mysql_version: string;
  active_theme: ThemeInfo;
  disk_usage: DiskUsage;
  db_size: string;
  max_upload_size: string;
  memory_limit: string;
  is_multisite: boolean;
  ssl_enabled: boolean;
  debug_mode: boolean;
  wp_cron_enabled: boolean;
  timezone: string;
  permalink_structure: string;
}

export interface ThemeInfo {
  name: string;
  version: string;
  template: string;
  stylesheet: string;
  is_child_theme: boolean;
  parent_theme?: string;
}

export interface DiskUsage {
  uploads_size: string;
  plugins_size: string;
  themes_size: string;
  total_size: string;
}

// ─── Plugin Types ────────────────────────────────────────────────────

export interface PluginInfo {
  slug: string;
  name: string;
  version: string;
  status: "active" | "inactive" | "must-use";
  update_available: boolean;
  update_version?: string;
  author: string;
  description: string;
  plugin_uri: string;
  requires_wp?: string;
  requires_php?: string;
}

// ─── Debug Log Types ─────────────────────────────────────────────────

export interface DebugLogEntry {
  timestamp: string;
  severity: "fatal" | "warning" | "notice" | "deprecated" | "parse" | "unknown";
  message: string;
  file?: string;
  line?: number;
  raw: string;
}

export interface DebugLogResponse {
  entries: DebugLogEntry[];
  file_size: string;
  last_modified: string;
  truncated: boolean;
}

// ─── Action Queue Types ──────────────────────────────────────────────

export type ActionStatus = "pending" | "processing" | "completed" | "failed" | "rolled_back";

export interface WPAction {
  id: string;
  website_id: string;
  integration_id: string;
  initiated_by: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  status: ActionStatus;
  error_message?: string;
  resource_type?: string;
  resource_id?: string;
  priority: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface QueueActionInput {
  website_id: string;
  integration_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  resource_type?: string;
  resource_id?: string;
  priority?: number;
}

// ─── AI Types ────────────────────────────────────────────────────────

export interface AIUsageRecord {
  id: string;
  website_id: string;
  user_id: string;
  action_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AICommandRequest {
  command: string;
  website_id: string;
  context?: Record<string, unknown>;
}

export interface AICommandProposal {
  id: string;
  description: string;
  changes: ProposedChange[];
  estimated_tokens: number;
}

export interface ProposedChange {
  id: string;
  resource_type: string;
  resource_id: string;
  resource_title: string;
  field: string;
  current_value: string | null;
  proposed_value: string;
  selected: boolean;
}

// ─── Active Session Types ────────────────────────────────────────────

export interface ActiveSession {
  id: string;
  website_id: string;
  user_id: string;
  user_email?: string;
  action_description?: string;
  resource_type?: string;
  resource_id?: string;
  last_heartbeat: string;
}

// ─── WP REST API Response Types ──────────────────────────────────────

export interface WPUser {
  id: number;
  name: string;
  slug: string;
  roles: string[];
  capabilities: Record<string, boolean>;
}

export interface WPMediaItem {
  id: number;
  title: { rendered: string };
  alt_text: string;
  source_url: string;
  media_details: {
    width: number;
    height: number;
    file: string;
    sizes: Record<string, { source_url: string; width: number; height: number }>;
  };
  mime_type: string;
}

export interface WPPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  status: string;
  meta: Record<string, unknown>;
  yoast_head_json?: {
    title?: string;
    description?: string;
    og_title?: string;
    og_description?: string;
  };
}

export interface WPPage extends WPPost {
  parent: number;
  menu_order: number;
  template: string;
}
