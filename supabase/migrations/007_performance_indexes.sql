-- ==================== PERFORMANCE INDEXES ====================
-- Migration 007: Add missing indexes for common query patterns
-- These cover hot paths identified during the optimization audit.

-- Webhook endpoint: lookup website by API key (every incoming lead)
create index if not exists websites_api_key_idx
  on public.websites(api_key);

-- Webhook endpoint: lookup website by client_id (joins + RLS)
create index if not exists websites_client_id_idx
  on public.websites(client_id);

-- Client access checks: lookup user's client assignments (every non-admin page load)
create index if not exists client_users_user_id_idx
  on public.client_users(user_id);

-- Client access checks: lookup client's users (notifications, permissions)
create index if not exists client_users_client_id_idx
  on public.client_users(client_id);

-- Leads pagination: ORDER BY created_at DESC with range queries
create index if not exists leads_created_at_idx
  on public.leads(created_at desc);

-- Integrations: lookup by client + type (webhook Facebook/GA4 lookup)
create index if not exists integrations_client_type_idx
  on public.integrations(client_id, type);

-- Profiles: lookup by email (login, invite duplicate checks)
create index if not exists profiles_email_idx
  on public.profiles(email);

-- Profiles: lookup by role (admin checks via is_admin() RLS function)
create index if not exists profiles_role_idx
  on public.profiles(role);
