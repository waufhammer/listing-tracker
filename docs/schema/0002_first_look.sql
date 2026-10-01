-- Run this by hand in the Supabase SQL editor. Not an executed migration —
-- see README.md in this directory.

-- Adds NWMLS "First Look" tracking to listings: an Active listing can be
-- toggled into First Look, and days spent in First Look are excluded from
-- days-on-market (both while active and permanently, once toggled off).

alter table listings
  add column first_look boolean not null default false,
  add column first_look_started_at timestamptz,
  add column first_look_days_banked integer not null default 0;
