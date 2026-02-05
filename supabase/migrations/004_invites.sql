-- User invitations table
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('admin', 'client')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  client_ids uuid[] default '{}',
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for token lookups
create index invites_token_idx on public.invites(token);
create index invites_email_idx on public.invites(email);

-- RLS
alter table public.invites enable row level security;

-- Only admins can manage invites
create policy "Admins can manage invites"
  on public.invites
  for all
  using (public.is_admin());

-- Allow public access to check token validity (for accept page)
create policy "Anyone can read invite by token"
  on public.invites
  for select
  using (true);

comment on table public.invites is 'Pending user invitations';
