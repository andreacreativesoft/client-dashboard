-- Add git_repo_url column to websites table
-- Allows linking each website to its Git repository
alter table public.websites
  add column git_repo_url varchar(500) default null;
