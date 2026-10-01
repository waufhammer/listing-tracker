# Schema reference

This repo doesn't track a live schema or use migration tooling — there's no
`supabase/` CLI folder and no ORM. Tables are created directly in the
Supabase SQL editor.

Files in this directory are **reference copies** of the SQL that was run
manually against the database, kept so the shape of each table is visible
in the repo. They are not executed automatically and will drift from the
live schema if changed here without also being applied in Supabase — if
you change a table, update the file here to match after applying the real
change in the dashboard.

- `0001_showing_verification.sql` — `showing_events`, `flagged_agents`,
  `showing_magic_links` tables for the automated showing-verification
  feature. See `/Users/willaufhammer/Downloads/showing-verification-prd.md`
  for the feature spec.
- `0002_first_look.sql` — adds `first_look`, `first_look_started_at`,
  `first_look_days_banked` columns to `listings` for NWMLS First Look
  tracking (excludes First Look days from days-on-market).
