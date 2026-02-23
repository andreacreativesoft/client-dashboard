-- ============================================================
-- Migration 019: Admin Settings (platform-level key-value store)
-- ============================================================
-- Stores platform-wide settings like API keys, feature toggles, etc.
-- Only admins can read/write. Values can optionally be encrypted.

CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  is_encrypted boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only admins can access
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_settings_admin_all"
  ON admin_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE TRIGGER set_admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);
