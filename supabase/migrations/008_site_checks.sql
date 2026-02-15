-- ============================================================
-- Site Checks — Admin tools (broken links, SEO audit, uptime)
-- ============================================================

CREATE TABLE public.site_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('broken_links', 'seo_audit', 'uptime')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  score INTEGER,
  summary JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_checks_website_idx ON public.site_checks(website_id);
CREATE INDEX site_checks_client_idx ON public.site_checks(client_id);
CREATE INDEX site_checks_type_idx ON public.site_checks(check_type, created_at DESC);

-- RLS
ALTER TABLE public.site_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site_checks"
  ON public.site_checks FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Client users can view their site_checks"
  ON public.site_checks FOR SELECT
  TO authenticated
  USING (client_id IN (SELECT public.get_user_client_ids()));
