-- Activity Logs table for tracking user actions
-- Trust-builder for disputes and transparency

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Index for querying by client
create index idx_activity_logs_client_id on public.activity_logs(client_id);

-- Index for querying by user
create index idx_activity_logs_user_id on public.activity_logs(user_id);

-- Index for recent activity queries
create index idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- RLS policies
alter table public.activity_logs enable row level security;

-- Admins can see all activity
create policy "Admins can view all activity"
  on public.activity_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Clients can only see activity for their assigned clients
create policy "Clients can view their client activity"
  on public.activity_logs for select
  using (
    client_id in (
      select client_id from public.client_users
      where user_id = auth.uid()
    )
  );

-- Only allow inserts via service role or authenticated users
create policy "Authenticated users can insert activity"
  on public.activity_logs for insert
  with check (auth.uid() is not null);
