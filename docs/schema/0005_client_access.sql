-- Phase 1: seller access by private token link + cookie (no passwords).
-- Run by hand in the Supabase SQL editor BEFORE deploying the Phase 1 code.
-- Safe to re-run: every statement is idempotent. Deletes nothing.

alter table listings
  add column if not exists client_link_token text unique,
  add column if not exists client_link_version integer not null default 1,
  add column if not exists client_link_rotated_at timestamptz;

update listings
  -- 64 hex characters from two random UUIDs; avoids needing the pgcrypto extension
  set client_link_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where client_link_token is null;

alter table listings alter column client_link_token set not null;

-- "Email me my link" requests. matched = the email belongs to a seller on
-- that listing; sent = the link was emailed (false when RESEND_API_KEY is not
-- set, or the hourly limit was hit: those show on the admin home page).
create table if not exists client_link_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  email text not null,
  matched boolean not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);
alter table client_link_requests enable row level security;
create index if not exists client_link_requests_listing_idx
  on client_link_requests(listing_id, created_at desc);

-- How a client page view got access: 'link' (just opened the /s/<token>
-- link), 'cookie' (returning visit), 'legacy_slug' (old /<slug> link during
-- the CLIENT_LINK_GRACE_UNTIL window).
alter table page_views add column if not exists via text;
