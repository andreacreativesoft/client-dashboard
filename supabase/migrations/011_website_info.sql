-- Website info board: key-value store for credentials, notes, and links per website
create table public.website_info (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  label varchar(100) not null,
  value text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.website_info enable row level security;

-- Admin full access
create policy "Admin full access on website_info"
  on public.website_info for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Clients can read info for their websites
create policy "Client read own website_info"
  on public.website_info for select
  using (
    exists (
      select 1 from public.websites w
      join public.client_users cu on cu.client_id = w.client_id
      where w.id = website_info.website_id
      and cu.user_id = auth.uid()
    )
  );

-- Index
create index idx_website_info_website_id on public.website_info(website_id);
