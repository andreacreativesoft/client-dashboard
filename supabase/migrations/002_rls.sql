-- ============================================================
-- 002 — Row Level Security + policies
--
-- Convention : 1 policy admin (FOR ALL via is_admin()) + policies client
-- (SELECT, parfois INSERT/UPDATE). Les tables filles d'un site dérivent le
-- client par jointure ; les autres via client_id + get_user_client_ids().
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.websites enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.connectors enable row level security;
alter table public.attributes enable row level security;
alter table public.uptime_checks enable row level security;
alter table public.uptime_incidents enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_notes enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_replies enable row level security;
alter table public.integrations enable row level security;
alter table public.analytics_cache enable row level security;
alter table public.invites enable row level security;
alter table public.activity_logs enable row level security;

-- ──────────────── profiles ────────────────
create policy "Admins can manage all profiles" on public.profiles
  for all to authenticated using (public.is_admin());
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ──────────────── clients ────────────────
create policy "Admins can manage clients" on public.clients
  for all to authenticated using (public.is_admin());
create policy "Client users can view their clients" on public.clients
  for select to authenticated using (id in (select public.get_user_client_ids()));

-- ──────────────── client_users ────────────────
create policy "Admins can manage client_users" on public.client_users
  for all to authenticated using (public.is_admin());
create policy "Users can view own client_user records" on public.client_users
  for select to authenticated using (user_id = (select auth.uid()));

-- ──────────────── websites ────────────────
create policy "Admins can manage websites" on public.websites
  for all to authenticated using (public.is_admin());
create policy "Client users can view their websites" on public.websites
  for select to authenticated using (client_id in (select public.get_user_client_ids()));

-- ──────────────── connected_accounts ────────────────
create policy "Admins can manage connected_accounts" on public.connected_accounts
  for all to authenticated using (public.is_admin());
create policy "Client users can view their connected_accounts" on public.connected_accounts
  for select to authenticated using (client_id in (select public.get_user_client_ids()));

-- ──────────────── connectors (admin-only : porte des secrets d'ingestion) ────────────────
create policy "Admins can manage connectors" on public.connectors
  for all to authenticated using (public.is_admin());
create policy "Client users can view their connectors" on public.connectors
  for select to authenticated using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── attributes ────────────────
create policy "Admins can manage attributes" on public.attributes
  for all to authenticated using (public.is_admin());
create policy "Client users can view their non-admin attributes" on public.attributes
  for select to authenticated using (
    is_admin_only = false
    and website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── uptime_checks ────────────────
create policy "Admins can manage uptime_checks" on public.uptime_checks
  for all to authenticated using (public.is_admin());
create policy "Client users can view their uptime_checks" on public.uptime_checks
  for select to authenticated using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── uptime_incidents ────────────────
create policy "Admins can manage uptime_incidents" on public.uptime_incidents
  for all to authenticated using (public.is_admin());
create policy "Client users can view their uptime_incidents" on public.uptime_incidents
  for select to authenticated using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── integrations ────────────────
create policy "Admins can manage integrations" on public.integrations
  for all to authenticated using (public.is_admin());
create policy "Client users can view their integrations" on public.integrations
  for select to authenticated using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── analytics_cache ────────────────
create policy "Admins can manage analytics_cache" on public.analytics_cache
  for all to authenticated using (public.is_admin());
create policy "Client users can view their analytics" on public.analytics_cache
  for select to authenticated using (
    website_id in (
      select w.id from public.websites w
      where w.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── submissions ────────────────
create policy "Admins can manage all submissions" on public.submissions
  for all to authenticated using (public.is_admin());
create policy "Client users can view their submissions" on public.submissions
  for select to authenticated using (client_id in (select public.get_user_client_ids()));
create policy "Client users can update their submission status" on public.submissions
  for update to authenticated using (client_id in (select public.get_user_client_ids()));

-- ──────────────── submission_notes ────────────────
create policy "Admins can manage all submission_notes" on public.submission_notes
  for all to authenticated using (public.is_admin());
create policy "Client users can view notes on their submissions" on public.submission_notes
  for select to authenticated using (
    submission_id in (
      select s.id from public.submissions s
      where s.client_id in (select public.get_user_client_ids())
    )
  );
create policy "Users can create notes on accessible submissions" on public.submission_notes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and submission_id in (
      select s.id from public.submissions s
      where s.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── tickets ────────────────
create policy "Admins can do everything with tickets" on public.tickets
  for all to authenticated using (public.is_admin());
create policy "Clients can view their tickets" on public.tickets
  for select to authenticated using (client_id in (select public.get_user_client_ids()));
create policy "Clients can create tickets" on public.tickets
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and client_id in (select public.get_user_client_ids())
  );

-- ──────────────── ticket_replies ────────────────
create policy "Admins can do everything with ticket replies" on public.ticket_replies
  for all to authenticated using (public.is_admin());
create policy "Clients can view non-internal replies" on public.ticket_replies
  for select to authenticated using (
    not is_internal
    and ticket_id in (
      select t.id from public.tickets t
      where t.client_id in (select public.get_user_client_ids())
    )
  );
create policy "Clients can create replies on their tickets" on public.ticket_replies
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and not is_internal
    and ticket_id in (
      select t.id from public.tickets t
      where t.client_id in (select public.get_user_client_ids())
    )
  );

-- ──────────────── invites ────────────────
create policy "Admins can manage invites" on public.invites
  for all to authenticated using (public.is_admin());
-- Lecture publique par token (page d'acceptation d'invitation, utilisateur non connecté).
create policy "Anyone can read invite by token" on public.invites
  for select using (true);

-- ──────────────── activity_logs ────────────────
create policy "Admins can view all activity" on public.activity_logs
  for select to authenticated using (public.is_admin());
create policy "Clients can view their client activity" on public.activity_logs
  for select to authenticated using (client_id in (select public.get_user_client_ids()));
create policy "Users can log activity for accessible clients" on public.activity_logs
  for insert to authenticated with check (
    public.is_admin()
    or client_id is null
    or client_id in (select public.get_user_client_ids())
  );
