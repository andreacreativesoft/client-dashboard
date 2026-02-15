-- Migration 012: WordPress AI Analyzer
-- Tables for storing WordPress site configs and AI analysis results.

-- ─── wp_site_configs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wp_site_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  local_path text NOT NULL,
  deploy_method text NOT NULL DEFAULT 'none' CHECK (deploy_method IN ('none', 'git', 'wp_migrate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(website_id)
);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER wp_site_configs_updated_at
  BEFORE UPDATE ON wp_site_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: admin-only
ALTER TABLE wp_site_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to wp_site_configs"
  ON wp_site_configs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── wp_analyses ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wp_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  site_data jsonb DEFAULT '{}',
  recommendations jsonb DEFAULT '[]',
  scores jsonb DEFAULT '{}',
  pages_analyzed integer DEFAULT 0,
  issues_found integer DEFAULT 0,
  claude_tokens integer DEFAULT 0,
  summary text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin-only
ALTER TABLE wp_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to wp_analyses"
  ON wp_analyses FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── Indexes ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wp_analyses_website_id ON wp_analyses(website_id);
CREATE INDEX IF NOT EXISTS idx_wp_analyses_client_id ON wp_analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_wp_analyses_status ON wp_analyses(status);
CREATE INDEX IF NOT EXISTS idx_wp_analyses_created_at ON wp_analyses(created_at DESC);
