-- Add change detection columns to websites table
-- Tracks content hash of live site to detect client-side changes
alter table public.websites
  add column content_hash varchar(64) default null,
  add column last_checked_at timestamptz default null,
  add column has_changes boolean not null default false;
