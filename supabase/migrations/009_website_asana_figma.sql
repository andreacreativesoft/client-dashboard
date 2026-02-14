-- Add Asana project URL and Figma URL columns to websites table
-- Allows linking each website to its Asana project and Figma design files
alter table public.websites
  add column asana_project_url varchar(500) default null,
  add column figma_url varchar(500) default null;
