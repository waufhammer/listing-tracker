-- Phase 5: missing activity fields, voiding, and the admin login rate limit.
-- Run by hand in the Supabase SQL editor BEFORE deploying the Phase 5 code.
-- Safe to re-run (if not exists). Deletes nothing.

alter table activity_entries
  add column if not exists showing_start time,
  add column if not exists showing_end time,
  add column if not exists agent_email text,
  add column if not exists agent_phone text,
  add column if not exists agent_brokerage text,
  add column if not exists source text check (source in ('showingtime','email','text','open_house','manual')),
  add column if not exists feedback_requested_at timestamptz,
  add column if not exists nudge_count integer not null default 0,
  add column if not exists last_nudge_at timestamptz,
  add column if not exists feedback_received_at timestamptz,
  add column if not exists follow_up_sent_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

-- Admin login rate limit: 5 failed tries per IP per 15 minutes.
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  success boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_at_idx on login_attempts(ip, at desc);
alter table login_attempts enable row level security;
