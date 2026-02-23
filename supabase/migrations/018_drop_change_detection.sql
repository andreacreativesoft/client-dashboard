-- Drop unused change detection columns from websites table
-- Feature removed — was too primitive (homepage HTML hash) for multi-admin sync
alter table public.websites
  drop column if exists content_hash,
  drop column if exists last_checked_at,
  drop column if exists has_changes;
