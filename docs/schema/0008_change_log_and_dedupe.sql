-- Phase 4: change log and duplicate protection.
-- Run by hand in the Supabase SQL editor BEFORE deploying the Phase 4 code.
-- Safe to re-run (if not exists / create or replace / drop trigger if
-- exists). Deletes nothing.

create table if not exists change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,                         -- 'claude' (connector) | 'will' (admin)
  action text not null,               -- insert | update | delete
  table_name text not null,
  row_id uuid,
  listing_id uuid,
  before jsonb,
  after jsonb
);
create index if not exists change_log_listing_idx on change_log(listing_id, at desc);
alter table change_log enable row level security;

-- updated_by / updated_at on each tracked table; writers set updated_by.
alter table activity_entries add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table listings         add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table listing_sellers  add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table platform_views   add column if not exists updated_by text, add column if not exists updated_at timestamptz;

create or replace function log_change() returns trigger as $$
declare lid uuid;
begin
  if tg_table_name = 'listings' then lid := coalesce(new.id, old.id);
  else lid := coalesce(new.listing_id, old.listing_id); end if;
  insert into change_log(actor, action, table_name, row_id, listing_id, before, after)
  values (coalesce(new.updated_by, old.updated_by), lower(tg_op), tg_table_name,
          coalesce(new.id, old.id), lid,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$ language plpgsql;

drop trigger if exists log_change on activity_entries;
create trigger log_change after insert or update or delete on activity_entries
  for each row execute function log_change();

drop trigger if exists log_change on listings;
create trigger log_change after insert or update or delete on listings
  for each row execute function log_change();

drop trigger if exists log_change on listing_sellers;
create trigger log_change after insert or update or delete on listing_sellers
  for each row execute function log_change();

drop trigger if exists log_change on platform_views;
create trigger log_change after insert or update or delete on platform_views
  for each row execute function log_change();

-- Dedupe
alter table activity_entries
  add column if not exists source_message_id text,
  add column if not exists showingtime_id text;
create unique index if not exists activity_source_msg_uq on activity_entries(source_message_id) where source_message_id is not null;
create unique index if not exists activity_showingtime_uq on activity_entries(showingtime_id) where showingtime_id is not null;

-- One online-views snapshot per listing per date. Checked 2026-11-16: no
-- duplicate dates exist (165 rows). If this statement fails with "could not
-- create unique index", duplicates were added since; find them with
--   select listing_id, date, count(*) from platform_views group by 1, 2 having count(*) > 1;
-- and choose which to keep before re-running. Nothing above depends on it.
create unique index if not exists platform_views_listing_date_uq on platform_views(listing_id, date);
