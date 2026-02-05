-- ============================================================
-- Reports Table for Monthly Auto-Generated PDFs
-- ============================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- TODO post-MVP: replace CASCADE with application-level cascade when soft-delete is added
  client_id uuid not null references public.clients(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  file_path text not null,
  file_size integer not null default 0,
  generated_at timestamptz not null default now(),
  sent_at timestamptz, -- When emailed to client
  created_at timestamptz not null default now(),
  unique(client_id, period_start, period_end)
);

create index reports_client_id_idx on public.reports(client_id);
create index reports_period_idx on public.reports(period_start, period_end);

-- RLS Policies
alter table public.reports enable row level security;

create policy "Admins can manage all reports"
  on public.reports for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their reports"
  on public.reports for select
  to authenticated
  using (client_id in (select public.get_user_client_ids()));

-- Storage bucket for reports (run manually in Supabase dashboard)
-- create policy "Authenticated users can read reports"
--   on storage.objects for select
--   to authenticated
--   using (bucket_id = 'reports');
--
-- create policy "Service role can upload reports"
--   on storage.objects for insert
--   to service_role
--   with check (bucket_id = 'reports');
