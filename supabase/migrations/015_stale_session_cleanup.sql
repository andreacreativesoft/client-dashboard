-- Migration 015: Stale Session Cleanup
-- Adds a function and optional pg_cron job to clean up stale wp_active_sessions.
-- Sessions with last_heartbeat older than 2 minutes are considered stale.

-- ─── Cleanup Function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_stale_wp_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM wp_active_sessions
  WHERE last_heartbeat < NOW() - INTERVAL '2 minutes';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─── Index for efficient cleanup queries ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wp_active_sessions_heartbeat
  ON wp_active_sessions(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_wp_active_sessions_website
  ON wp_active_sessions(website_id, user_id);

-- ─── Optional: pg_cron job (requires pg_cron extension) ─────────────────
-- Uncomment the lines below if pg_cron is enabled on your Supabase project.
-- This runs cleanup every minute automatically.
--
-- SELECT cron.schedule(
--   'cleanup-stale-wp-sessions',
--   '* * * * *',
--   'SELECT cleanup_stale_wp_sessions()'
-- );
