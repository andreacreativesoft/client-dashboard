-- ============================================================
-- 001 — Schéma applicatif (baseline propre)
--
-- Consolidation de l'historique (ancien 001→033) en un schéma net,
-- sans dette des modules retirés ni des renames de la refonte data.
-- État de référence = base réelle après l'ancienne chaîne complète.
--
-- Extensions · fonctions · tables · contraintes · index · triggers.
-- La RLS + les policies vivent dans 002_rls.sql ; le storage dans 003_storage.sql.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- Les fonctions SQL référencent des tables créées plus bas : on diffère la
-- validation des corps (comme pg_dump). Les tables existent à l'exécution.
set check_function_bodies = false;

-- ──────────────────────────────────────────────────────────
-- Fonctions
-- ──────────────────────────────────────────────────────────

-- updated_at auto sur UPDATE.
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Variante dédiée aux tickets (même effet, nom historique conservé côté trigger).
create or replace function public.update_ticket_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profil créé automatiquement à l'inscription d'un utilisateur Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
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

-- Helpers RLS.
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.get_user_client_ids()
returns setof uuid language sql stable security definer as $$
  select client_id from public.client_users
  where user_id = (select auth.uid());
$$;

-- Agrégats analytics des submissions (RPC).
create or replace function public.submission_daily_counts(p_client_id uuid, p_days integer)
returns table(day date, count bigint)
language sql stable set search_path to 'public' as $$
  select s.created_at::date as day, count(*) as count
  from public.submissions s
  where s.created_at >= (now() - make_interval(days => p_days))
    and (p_client_id is null or s.client_id = p_client_id)
  group by 1
  order by 1;
$$;

create or replace function public.submission_top_sources(p_client_id uuid, p_days integer, p_limit integer)
returns table(source text, count bigint)
language sql stable set search_path to 'public' as $$
  select coalesce(w.name, con.label, 'Direct') as source, count(*) as count
  from public.submissions s
  left join public.connectors con on con.id = s.connector_id
  left join public.websites w on w.id = con.website_id
  where s.created_at >= (now() - make_interval(days => p_days))
    and (p_client_id is null or s.client_id = p_client_id)
  group by 1
  order by 2 desc
  limit p_limit;
$$;

-- ──────────────────────────────────────────────────────────
-- Tables (ordre des dépendances FK)
-- ──────────────────────────────────────────────────────────

-- Profils — étend auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  full_name varchar(255) not null default '',
  email varchar(255) not null,
  phone varchar(50),
  avatar_url text,
  last_login_at timestamptz,
  is_blocked boolean not null default false,
  language varchar(10) not null default 'fr-BE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles(email);
create index profiles_role_idx on public.profiles(role);
create index profiles_is_blocked_idx on public.profiles(is_blocked);
create index profiles_last_login_at_idx on public.profiles(last_login_at);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

-- Clients (commerçants/artisans).
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
create trigger clients_updated_at before update on public.clients
  for each row execute function public.update_updated_at();

-- Liaison utilisateurs ↔ clients.
create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_role text not null default 'viewer' check (access_role in ('owner', 'viewer')),
  created_at timestamptz not null default now(),
  -- Modèle produit : 1 compte = 1 commerce. Un utilisateur client n'appartient
  -- qu'à un seul client (verrou ; la résolution applicative s'appuie dessus).
  unique (user_id)
);
create index client_users_client_id_idx on public.client_users(client_id);
create index client_users_user_id_idx on public.client_users(user_id);

-- Sites web.
create table public.websites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name varchar(255) not null,
  url varchar(500) not null,
  is_active boolean not null default true,
  platform varchar(50) not null default 'wordpress',
  uptime_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index websites_client_id_idx on public.websites(client_id);
create trigger websites_updated_at before update on public.websites
  for each row execute function public.update_updated_at();

-- Credentials OAuth génériques (tokens chiffrés côté applicatif).
create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider varchar(50) not null,
  external_account_id varchar(255),
  external_account_label varchar(255),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, provider, external_account_id)
);
create index connected_accounts_client_id_idx on public.connected_accounts(client_id);
create trigger connected_accounts_updated_at before update on public.connected_accounts
  for each row execute function public.update_updated_at();

-- Connecteurs (portes de collecte des prospects).
create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  kind varchar(50) not null default 'generic-webhook',
  name varchar(255) not null default '',
  label varchar(100) not null default 'Prospect',
  ingest_token varchar(64) not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  signing_secret varchar(64) not null default encode(extensions.gen_random_bytes(32), 'hex'),
  config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index connectors_website_id_idx on public.connectors(website_id);
create trigger connectors_updated_at before update on public.connectors
  for each row execute function public.update_updated_at();

-- Infos & accès du site (métadonnées à presets).
create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  type varchar(50),
  title varchar(255) not null,
  value text not null default '',
  is_sensitive boolean not null default false,
  is_admin_only boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attributes_website_id_idx on public.attributes(website_id);
create trigger attributes_updated_at before update on public.attributes
  for each row execute function public.update_updated_at();

-- Uptime : historique des checks.
create table public.uptime_checks (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  checked_at timestamptz not null default now(),
  status varchar(20) not null check (status in ('up', 'down', 'degraded')),
  http_status integer,
  response_ms integer,
  error text
);
create index uptime_checks_website_checked_idx on public.uptime_checks(website_id, checked_at desc);

-- Uptime : incidents (périodes down dérivées).
create table public.uptime_incidents (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  started_at timestamptz not null,
  resolved_at timestamptz,
  last_status varchar(20) not null check (last_status in ('down', 'degraded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index uptime_incidents_website_idx on public.uptime_incidents(website_id, started_at desc);
create trigger uptime_incidents_updated_at before update on public.uptime_incidents
  for each row execute function public.update_updated_at();

-- Submissions (prospects/formulaires reçus).
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  connector_id uuid references public.connectors(id) on delete set null,
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
create index submissions_client_id_idx on public.submissions(client_id);
create index submissions_connector_id_idx on public.submissions(connector_id);
create index submissions_status_idx on public.submissions(status);
create index submissions_submitted_at_idx on public.submissions(submitted_at);
create index submissions_created_at_idx on public.submissions(created_at);

-- Notes internes sur une submission.
create table public.submission_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index submission_notes_submission_id_idx on public.submission_notes(submission_id);

-- Demandes (tickets de support).
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  subject text not null,
  description text not null,
  status varchar(20) not null default 'open',
  priority varchar(10) not null default 'medium',
  type text not null default 'other',
  details jsonb not null default '{}',
  due_date timestamptz,
  closed_at timestamptz,
  number bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Numéro de demande lisible, séquence globale.
create sequence public.tickets_number_seq owned by public.tickets.number;
alter table public.tickets
  alter column number set default nextval('public.tickets_number_seq'),
  add constraint tickets_number_unique unique (number);
create index tickets_client_id_idx on public.tickets(client_id);
create index tickets_created_by_idx on public.tickets(created_by);
create index tickets_assigned_to_idx on public.tickets(assigned_to);
create index tickets_status_idx on public.tickets(status);
create index tickets_created_at_idx on public.tickets(created_at);
create trigger trigger_update_ticket_updated_at before update on public.tickets
  for each row execute function public.update_ticket_updated_at();

-- Réponses aux demandes (humaines + système).
create table public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null,
  is_internal boolean not null default false,
  kind varchar(10) not null default 'reply' check (kind in ('reply', 'system')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index ticket_replies_ticket_id_idx on public.ticket_replies(ticket_id);

-- Intégrations analytics (GA4/GBP/GSC), adossées à un connected_account.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  account_id uuid not null references public.connected_accounts(id) on delete cascade,
  service varchar(10) not null check (service in ('ga4', 'gbp', 'gsc')),
  resource_id varchar(255) not null,
  resource_label varchar(255),
  config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, service, resource_id)
);
create index integrations_website_id_idx on public.integrations(website_id);
create index integrations_account_id_idx on public.integrations(account_id);
create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.update_updated_at();

-- Cache des métriques analytics.
create table public.analytics_cache (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  service varchar(10) not null check (service in ('ga4', 'gbp', 'gsc')),
  metric_type varchar(50) not null,
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (website_id, service, metric_type, period_start, period_end)
);
create index analytics_cache_website_id_idx on public.analytics_cache(website_id);

-- Invitations utilisateurs.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('admin', 'client')),
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  client_ids uuid[] default '{}',
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_email_idx on public.invites(email);
create index invites_token_idx on public.invites(token);

-- Journal d'activité.
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);
create index activity_logs_client_id_idx on public.activity_logs(client_id);
create index activity_logs_user_id_idx on public.activity_logs(user_id);
create index activity_logs_created_at_idx on public.activity_logs(created_at);
