-- Run this by hand in the Supabase SQL editor. Not an executed migration —
-- see README.md in this directory.

-- The capture button (/admin/capture) records who saved each platform views
-- count, the same way activity_entries.logged_by does ("will" or
-- "assistant", from the "Logging as" profile picker). Null for rows entered
-- before this column existed.

alter table platform_views
  add column logged_by text;
