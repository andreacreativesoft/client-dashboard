-- ============================================================
-- Client Dashboard Platform — Initial Schema
-- ============================================================

-- ==================== PROFILES ====================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  full_name varchar(255) not null default '',
  email varchar(255) not null,
  phone varchar(50),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ==================== CLIENTS ====================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name varchar(255) not null,
  contact_email varchar(255),
  contact_phone varchar(50),
  logo_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.update_updated_at();

-- ==================== CLIENT_USERS ====================
create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_role text not null default 'viewer' check (access_role in ('owner', 'viewer')),
  created_at timestamptz not null default now(),
  unique(client_id, user_id)
);

-- ==================== WEBSITES ====================
create table public.websites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name varchar(255) not null,
  url varchar(500) not null,
  api_key varchar(64) not null default encode(gen_random_bytes(32), 'hex'),
  webhook_secret varchar(64) not null default encode(gen_random_bytes(32), 'hex'),
  source_type varchar(50) not null default 'elementor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger websites_updated_at
  before update on public.websites
  for each row execute function public.update_updated_at();

-- ==================== LEADS ====================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  form_name varchar(255),
  source varchar(50) not null default 'webhook' check (source in ('webhook', 'manual', 'api')),
  name varchar(255),
  email varchar(255),
  phone varchar(50),
  message text,
  raw_data jsonb not null default '{}',
  status text not null default 'new' check (status in ('new', 'contacted', 'done')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index leads_website_id_idx on public.leads(website_id);
create index leads_status_idx on public.leads(status);
create index leads_submitted_at_idx on public.leads(submitted_at desc);

-- ==================== LEAD_NOTES ====================
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index lead_notes_lead_id_idx on public.lead_notes(lead_id);

-- ==================== INTEGRATIONS ====================
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('ga4', 'gbp')),
  account_id varchar(255) not null,
  account_name varchar(255),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, type, account_id)
);

create trigger integrations_updated_at
  before update on public.integrations
  for each row execute function public.update_updated_at();

-- ==================== ANALYTICS_CACHE ====================
create table public.analytics_cache (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  integration_type text not null check (integration_type in ('ga4', 'gbp')),
  metric_type varchar(50) not null,
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(client_id, integration_type, metric_type, period_start, period_end)
);

create index analytics_cache_client_idx on public.analytics_cache(client_id);
create index analytics_cache_period_idx on public.analytics_cache(period_start, period_end);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: is current user admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Helper: get client IDs accessible by current user
create or replace function public.get_user_client_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select client_id from public.client_users
  where user_id = (select auth.uid());
$$;

-- ===== PROFILES =====
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Admins can manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin());

-- ===== CLIENTS =====
alter table public.clients enable row level security;

create policy "Admins can manage clients"
  on public.clients for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their clients"
  on public.clients for select
  to authenticated
  using (id in (select public.get_user_client_ids()));

-- ===== CLIENT_USERS =====
alter table public.client_users enable row level security;

create policy "Admins can manage client_users"
  on public.client_users for all
  to authenticated
  using (public.is_admin());

create policy "Users can view own client_user records"
  on public.client_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ===== WEBSITES =====
alter table public.websites enable row level security;

create policy "Admins can manage websites"
  on public.websites for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their websites"
  on public.websites for select
  to authenticated
  using (client_id in (select public.get_user_client_ids()));

-- ===== LEADS =====
alter table public.leads enable row level security;

create policy "Admins can manage all leads"
  on public.leads for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their leads"
  on public.leads for select
  to authenticated
  using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

create policy "Client users can update their lead status"
  on public.leads for update
  to authenticated
  using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ===== LEAD_NOTES =====
alter table public.lead_notes enable row level security;

create policy "Admins can manage all lead_notes"
  on public.lead_notes for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view notes on their leads"
  on public.lead_notes for select
  to authenticated
  using (
    lead_id in (
      select l.id from public.leads l
      join public.websites w on w.id = l.website_id
      where w.client_id in (select public.get_user_client_ids())
    )
  );

create policy "Users can create notes on accessible leads"
  on public.lead_notes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and lead_id in (
      select l.id from public.leads l
      join public.websites w on w.id = l.website_id
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ===== INTEGRATIONS =====
alter table public.integrations enable row level security;

create policy "Admins can manage integrations"
  on public.integrations for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their integrations"
  on public.integrations for select
  to authenticated
  using (client_id in (select public.get_user_client_ids()));

-- ===== ANALYTICS_CACHE =====
alter table public.analytics_cache enable row level security;

create policy "Admins can manage analytics_cache"
  on public.analytics_cache for all
  to authenticated
  using (public.is_admin());

create policy "Client users can view their analytics"
  on public.analytics_cache for select
  to authenticated
  using (client_id in (select public.get_user_client_ids()));
