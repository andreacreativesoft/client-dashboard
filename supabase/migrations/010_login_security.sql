-- Migration 010: Login Security
-- Adds is_blocked column to profiles for account blocking after too many failed login attempts.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Index for quick lookup during login
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles (is_blocked) WHERE is_blocked = true;
