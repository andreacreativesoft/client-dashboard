-- ============================================================
-- Push Subscriptions Table for PWA Notifications
-- ============================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.update_updated_at();

-- RLS Policies
alter table public.push_subscriptions enable row level security;

create policy "Users can manage own subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Admins can view all subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (public.is_admin());
