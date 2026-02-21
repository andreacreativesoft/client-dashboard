-- Migration 014: WordPress Management Hub — Phase 1
-- Dedicated credentials table, action queue, AI usage tracking, active sessions

-- ─── WordPress Credentials ───────────────────────────────────────────
-- All sensitive fields individually AES-encrypted in the application layer.

CREATE TABLE IF NOT EXISTS wordpress_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  username_encrypted TEXT NOT NULL,
  app_password_encrypted TEXT NOT NULL,
  shared_secret_encrypted TEXT NOT NULL,
  ssh_host_encrypted TEXT,
  ssh_user_encrypted TEXT,
  ssh_key_encrypted TEXT,
  ssh_port INTEGER DEFAULT 22,
  mu_plugin_installed BOOLEAN DEFAULT FALSE,
  mu_plugin_version TEXT,
  last_health_check TIMESTAMPTZ,
  last_health_status JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(integration_id)
);

-- Updated_at trigger
CREATE TRIGGER update_wordpress_credentials_updated_at
  BEFORE UPDATE ON wordpress_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Action Queue ────────────────────────────────────────────────────
-- Serialized writes with before/after state for rollback support.

CREATE TABLE IF NOT EXISTS wp_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  before_state JSONB,
  after_state JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rolled_back')),
  error_message TEXT,
  resource_type TEXT,
  resource_id TEXT,
  priority INTEGER DEFAULT 5,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Per-site queue processing (pending first, by priority)
CREATE INDEX idx_wp_action_queue_processing
  ON wp_action_queue(website_id, status, priority, created_at);

-- Resource locking (prevent concurrent edits to same resource)
CREATE INDEX idx_wp_action_queue_resource
  ON wp_action_queue(website_id, resource_type, resource_id, status);

-- ─── AI Usage Tracking ──────────────────────────────────────────────
-- Per-site cost visibility for Claude API usage.

CREATE TABLE IF NOT EXISTS wp_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250514',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_wp_ai_usage_website
  ON wp_ai_usage(website_id, created_at DESC);

-- ─── Active Sessions (Realtime Presence) ────────────────────────────
-- Tracks who is actively working on a site to prevent conflicts.

CREATE TABLE IF NOT EXISTS wp_active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_description TEXT,
  resource_type TEXT,
  resource_id TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── Enable Supabase Realtime ───────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wp_action_queue;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wp_active_sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── RLS Policies ───────────────────────────────────────────────────
-- Admin-only access, matching existing integration/site_checks patterns.

ALTER TABLE wordpress_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE wp_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE wp_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE wp_active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to wordpress_credentials"
  ON wordpress_credentials FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin full access to wp_action_queue"
  ON wp_action_queue FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin full access to wp_ai_usage"
  ON wp_ai_usage FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin full access to wp_active_sessions"
  ON wp_active_sessions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
