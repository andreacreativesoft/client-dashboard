-- Add last_login_at to profiles for tracking inactive users
alter table public.profiles
add column if not exists last_login_at timestamptz;

-- Create index for querying inactive users
create index if not exists idx_profiles_last_login_at on public.profiles(last_login_at);

-- Function to update last login (called after successful auth)
create or replace function public.update_last_login()
returns trigger as $$
begin
  update public.profiles
  set last_login_at = now()
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;
