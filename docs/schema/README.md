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

- `0002_first_look.sql` — adds `first_look`, `first_look_started_at`,
  `first_look_days_banked` columns to `listings` for NWMLS First Look
  tracking (excludes First Look days from days-on-market).
- `0003_open_house_disclosure_requests.sql` — adds
  `open_house_disclosure_requests` to `activity_entries`, a count of buyer
  disclosure package requests at an Open House (Showing/Preview entries
  already had the boolean `buyer_packet_requested` for this).
- `0004_weekly_seller_update.sql` — `listing_sellers`, `weekly_update_drafts`,
  and `page_views.user_agent` for the weekly seller update.
- `0005_client_access.sql` — private seller links: `listings.client_link_token`
  (64 hex characters, backfilled), `client_link_version`,
  `client_link_rotated_at`; the `client_link_requests` table for "Email me my
  link"; and `page_views.via`. Run before deploying Phase 1.
- (no `0006`: Phase 2 had no schema change.)
- `0007_feedback_approval.sql` — `activity_entries.feedback_approved_at` /
  `feedback_approved_by`, a trigger that hides visible feedback again when
  its text is edited without a new approval, and a one-time backfill
  (`raw_feedback` from `display_feedback` where empty; already-visible
  entries marked approved by `'legacy'`). Run before deploying Phase 3.
