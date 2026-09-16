-- Run this by hand in the Supabase SQL editor. Not an executed migration —
-- see README.md in this directory.

create table showing_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  event_type text not null check (event_type in ('showing_confirmed', 'keybox_access')),
  raw_address text not null,
  normalized_address text not null,
  agent_name text,
  agent_brokerage text,
  agent_phone text,
  agent_email text,
  scheduled_time timestamptz,
  access_time timestamptz,
  gmail_message_id text unique not null,
  raw_email_snippet text,
  matched_event_id uuid references showing_events(id),
  status text not null default 'pending' check (
    status in ('scheduled', 'confirmed_occurred', 'unconfirmed_occurred', 'no_show', 'needs_review', 'excluded_self_or_open_house')
  ),
  created_at timestamptz default now()
);
create index on showing_events (normalized_address, coalesce(scheduled_time, access_time));
create index on showing_events (listing_id, status);

create table flagged_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  reason text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table showing_magic_links (
  id uuid primary key default gen_random_uuid(),
  showing_event_id uuid references showing_events(id) not null,
  token text unique not null,
  action text not null check (action in ('log_as_showing', 'not_a_showing')),
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Seed row from a real captured self-access Supra email (see PRD).
insert into flagged_agents (name, phone, email, reason)
values ('William Aufhammer', '206 604-4992', 'will.aufhammer@compass.com', 'self');
