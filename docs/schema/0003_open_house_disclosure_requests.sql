-- Run this by hand in the Supabase SQL editor. Not an executed migration —
-- see README.md in this directory.

-- Open House entries had no way to log buyer disclosure package requests —
-- only Buyer Showing / Agent Preview entries had the boolean
-- buyer_packet_requested toggle. An open house can have several requests in
-- one visit, so this is a count rather than a boolean.

alter table activity_entries
  add column open_house_disclosure_requests integer;
