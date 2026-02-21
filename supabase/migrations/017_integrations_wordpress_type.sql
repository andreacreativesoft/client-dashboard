-- Migration 017: Add 'wordpress' to integrations type check constraint
-- The integrations table was created with type IN ('ga4', 'gbp', 'gsc', 'facebook')
-- but the WordPress integration feature needs 'wordpress' as a valid type.

ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_type_check;

ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('ga4', 'gbp', 'gsc', 'facebook', 'wordpress'));
