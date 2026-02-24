/**
 * Estimated token usage and cost per AI tool / command type.
 *
 * Base overhead per API call:
 *   - System prompt:     ~700 tokens
 *   - 40 tool schemas:   ~4,800 tokens
 *   - Minimum per call:  ~5,500 input tokens
 *
 * Cost formula (Claude Sonnet 4):
 *   (input_tokens × $3 + output_tokens × $15) / 1,000,000
 *
 * These are estimates for a *typical single command* that uses the tool
 * as its primary action, including all agentic loops (read → analyze → act).
 */

export interface ToolCostEstimate {
  /** Estimated total input tokens for a typical command using this tool */
  inputTokens: number;
  /** Estimated total output tokens */
  outputTokens: number;
  /** Typical number of agentic loops (API round-trips) */
  loops: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

/**
 * Per-tool cost estimates. Keyed by tool name from wpAITools.
 */
export const TOOL_COST_ESTIMATES: Record<string, ToolCostEstimate> = {
  // ─── Content — Read ──────────────────────────────────────────────
  list_media:     { inputTokens: 12_000, outputTokens:   400, loops: 2, estimatedCostUsd: 0.042 },
  get_media_item: { inputTokens: 12_000, outputTokens:   400, loops: 2, estimatedCostUsd: 0.042 },
  list_pages:     { inputTokens: 12_000, outputTokens:   400, loops: 2, estimatedCostUsd: 0.042 },
  get_page:       { inputTokens: 13_000, outputTokens:   500, loops: 2, estimatedCostUsd: 0.047 },
  list_posts:     { inputTokens: 12_000, outputTokens:   400, loops: 2, estimatedCostUsd: 0.042 },
  get_post:       { inputTokens: 13_000, outputTokens:   500, loops: 2, estimatedCostUsd: 0.047 },
  list_menus:     { inputTokens: 11_000, outputTokens:   300, loops: 2, estimatedCostUsd: 0.038 },
  get_menu_items: { inputTokens: 12_000, outputTokens:   400, loops: 2, estimatedCostUsd: 0.042 },

  // ─── Content — Write (proposal-based, multi-loop) ────────────────
  update_media_alt: { inputTokens: 20_000, outputTokens:   800, loops: 3, estimatedCostUsd: 0.072 },
  update_page:      { inputTokens: 22_000, outputTokens: 1_000, loops: 3, estimatedCostUsd: 0.081 },
  update_post:      { inputTokens: 22_000, outputTokens: 1_000, loops: 3, estimatedCostUsd: 0.081 },
  toggle_plugin:    { inputTokens: 18_000, outputTokens:   600, loops: 3, estimatedCostUsd: 0.063 },
  create_menu_item: { inputTokens: 18_000, outputTokens:   600, loops: 3, estimatedCostUsd: 0.063 },

  // ─── Content Creation ────────────────────────────────────────────
  create_post: { inputTokens: 18_000, outputTokens: 4_000, loops: 3, estimatedCostUsd: 0.114 },

  // ─── Site Health & Diagnostics — Read ────────────────────────────
  get_site_health: { inputTokens: 13_000, outputTokens: 500, loops: 2, estimatedCostUsd: 0.047 },
  list_plugins:    { inputTokens: 12_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.042 },
  list_themes:     { inputTokens: 12_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.042 },
  get_debug_log:   { inputTokens: 16_000, outputTokens: 800, loops: 2, estimatedCostUsd: 0.060 },
  get_db_health:   { inputTokens: 12_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.042 },

  // ─── Image Analysis (includes Claude Vision sub-call) ────────────
  analyze_image: { inputTokens: 15_000, outputTokens: 500, loops: 2, estimatedCostUsd: 0.053 },

  // ─── Plugin/Theme/Core Updates — Direct Action ───────────────────
  update_plugin: { inputTokens: 18_000, outputTokens: 500, loops: 3, estimatedCostUsd: 0.062 },
  update_theme:  { inputTokens: 18_000, outputTokens: 500, loops: 3, estimatedCostUsd: 0.062 },
  update_core:   { inputTokens: 16_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.054 },

  // ─── WooCommerce — Read ──────────────────────────────────────────
  get_wc_orders:    { inputTokens: 14_000, outputTokens: 600, loops: 2, estimatedCostUsd: 0.051 },
  get_wc_order:     { inputTokens: 14_000, outputTokens: 600, loops: 2, estimatedCostUsd: 0.051 },
  get_wc_stats:     { inputTokens: 13_000, outputTokens: 500, loops: 2, estimatedCostUsd: 0.047 },
  list_wc_products: { inputTokens: 14_000, outputTokens: 500, loops: 2, estimatedCostUsd: 0.050 },
  get_wc_product:   { inputTokens: 14_000, outputTokens: 600, loops: 2, estimatedCostUsd: 0.051 },

  // ─── WooCommerce — Write ─────────────────────────────────────────
  update_wc_product: { inputTokens: 22_000, outputTokens: 800, loops: 3, estimatedCostUsd: 0.078 },
  update_wc_order:   { inputTokens: 18_000, outputTokens: 600, loops: 3, estimatedCostUsd: 0.063 },

  // ─── User Management ────────────────────────────────────────────
  list_wp_users:      { inputTokens: 12_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.042 },
  create_wp_user:     { inputTokens: 14_000, outputTokens: 500, loops: 2, estimatedCostUsd: 0.050 },
  update_wp_user:     { inputTokens: 18_000, outputTokens: 500, loops: 3, estimatedCostUsd: 0.062 },
  delete_wp_user:     { inputTokens: 16_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.054 },
  send_password_reset:{ inputTokens: 14_000, outputTokens: 400, loops: 2, estimatedCostUsd: 0.048 },

  // ─── Maintenance — Direct Action ─────────────────────────────────
  clear_cache:         { inputTokens: 12_000, outputTokens: 300, loops: 2, estimatedCostUsd: 0.041 },
  toggle_maintenance:  { inputTokens: 12_000, outputTokens: 300, loops: 2, estimatedCostUsd: 0.041 },

  // ─── Proposals (meta-tool, always combined with reads) ───────────
  propose_changes: { inputTokens: 22_000, outputTokens: 1_200, loops: 4, estimatedCostUsd: 0.084 },
};

/**
 * Per-category cost summaries, computed from typical command patterns.
 */
export interface CategoryCostSummary {
  label: string;
  minCost: number;
  maxCost: number;
  avgCost: number;
  description: string;
}

export const CATEGORY_COST_SUMMARIES: CategoryCostSummary[] = [
  {
    label: "Read / Query",
    minCost: 0.038,
    maxCost: 0.060,
    avgCost: 0.044,
    description: "Listing or viewing pages, posts, media, plugins, users, orders",
  },
  {
    label: "Content Edits",
    minCost: 0.063,
    maxCost: 0.084,
    avgCost: 0.074,
    description: "Editing pages, posts, ALT text via proposal workflow",
  },
  {
    label: "Blog Post Creation",
    minCost: 0.090,
    maxCost: 0.150,
    avgCost: 0.114,
    description: "Writing a full SEO-optimized blog post (draft)",
  },
  {
    label: "Updates & Actions",
    minCost: 0.041,
    maxCost: 0.063,
    avgCost: 0.055,
    description: "Plugin/theme/core updates, cache clear, maintenance mode",
  },
  {
    label: "WooCommerce",
    minCost: 0.047,
    maxCost: 0.078,
    avgCost: 0.056,
    description: "Orders, products, store stats, product updates",
  },
  {
    label: "User Management",
    minCost: 0.042,
    maxCost: 0.062,
    avgCost: 0.051,
    description: "Creating, updating, or deleting WordPress users",
  },
  {
    label: "Image ALT Text (batch)",
    minCost: 0.10,
    maxCost: 0.50,
    avgCost: 0.25,
    description: "Analyzing multiple images and generating ALT text (varies by count)",
  },
];

/**
 * Model pricing reference (per 1M tokens, USD).
 */
export const MODEL_PRICING = {
  "claude-sonnet-4-20250514": {
    label: "Claude Sonnet 4",
    inputPer1M: 3,
    outputPer1M: 15,
  },
  "claude-haiku-4-5-20251001": {
    label: "Claude Haiku 4.5",
    inputPer1M: 0.80,
    outputPer1M: 4,
  },
  "claude-opus-4-6": {
    label: "Claude Opus 4.6",
    inputPer1M: 15,
    outputPer1M: 75,
  },
} as const;
