-- Add language preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';
