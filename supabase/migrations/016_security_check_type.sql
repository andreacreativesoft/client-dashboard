-- ============================================================
-- Add 'security' to site_checks check_type constraint
-- ============================================================

ALTER TABLE public.site_checks
  DROP CONSTRAINT IF EXISTS site_checks_check_type_check;

ALTER TABLE public.site_checks
  ADD CONSTRAINT site_checks_check_type_check
  CHECK (check_type IN ('broken_links', 'seo_audit', 'uptime', 'security'));
