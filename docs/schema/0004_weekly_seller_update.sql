-- Run this by hand in the Supabase SQL editor. Not an executed migration —
-- see README.md in this directory.

-- Weekly seller update (spec: "Weekly Seller Update: Template and Rules").

-- 1. CDOM. A cancel and relist resets NWMLS days on market but cumulative
--    days on market keeps climbing. Relists edit the existing listing: set
--    list_date to the relist date and put the days from the earlier listing
--    period(s) here. CDOM = prior_days_on_market + DOM. A listing counts as
--    relisted (and shows CDOM) when this is > 0.
alter table listings
  add column if not exists prior_days_on_market integer not null default 0;

-- 2. Sellers on a listing. Every seller gets the weekly email (To:), and
--    first names build the greeting.
create table if not exists listing_sellers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists listing_sellers_listing_id_idx on listing_sellers(listing_id);
alter table listing_sellers enable row level security;

-- 3. Client link view log. page_views already gets a row per load of the
--    client link; add the browser so the admin log can show it. Visits
--    while logged into admin are no longer logged at all.
alter table page_views add column if not exists user_agent text;

-- 4. App settings (key/value). Holds the Gmail signature HTML.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- 5. One row per listing per week once a Gmail draft exists, so a rerun
--    never creates a duplicate draft.
create table if not exists weekly_update_drafts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  send_date date not null,          -- the Monday the draft is for
  gmail_draft_id text,
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  unique (listing_id, send_date)
);
alter table weekly_update_drafts enable row level security;
