-- Migration 017: Add analysis_mode to wp_site_configs and wp_analyses
-- Allows admin to choose between online (HTTP crawl) and local (filesystem) analysis.

-- Add analysis_mode to wp_site_configs (default: online)
ALTER TABLE wp_site_configs
  ADD COLUMN IF NOT EXISTS analysis_mode text NOT NULL DEFAULT 'online'
  CHECK (analysis_mode IN ('online', 'local'));

-- Make local_path optional (online mode doesn't need it)
ALTER TABLE wp_site_configs
  ALTER COLUMN local_path SET DEFAULT '';

-- Add analysis_mode to wp_analyses (tracks which mode was used)
ALTER TABLE wp_analyses
  ADD COLUMN IF NOT EXISTS analysis_mode text NOT NULL DEFAULT 'online'
  CHECK (analysis_mode IN ('online', 'local'));
