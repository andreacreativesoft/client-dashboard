-- ==================== ADDITIONAL PERFORMANCE INDEXES ====================
-- Migration 009: Indexes identified during code optimization audit.

-- Push subscriptions: lookup by user_id (webhook notification fanout)
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

-- Analytics cache: composite lookup for cache hits
-- Queries always filter on (client_id, integration_type, metric_type, period_start, period_end)
create unique index if not exists analytics_cache_lookup_idx
  on public.analytics_cache(client_id, integration_type, metric_type, period_start, period_end);

-- Analytics cache: cleanup stale entries by fetched_at
create index if not exists analytics_cache_fetched_at_idx
  on public.analytics_cache(fetched_at);

-- Activity logs: lookup by client_id (client detail page activity tab)
create index if not exists activity_logs_client_id_idx
  on public.activity_logs(client_id);

-- Activity logs: sort by created_at (most recent first)
create index if not exists activity_logs_created_at_idx
  on public.activity_logs(created_at desc);

-- Leads: filter by client_id (denormalized for fast client-scoped queries)
create index if not exists leads_client_id_idx
  on public.leads(client_id);

-- Leads: filter by status (status filter on leads page)
create index if not exists leads_status_idx
  on public.leads(status);
