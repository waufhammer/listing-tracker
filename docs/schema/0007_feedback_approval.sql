-- Phase 3: private and client-facing feedback kept apart.
-- Run by hand in the Supabase SQL editor BEFORE deploying the Phase 3 code.
-- Safe to re-run (if not exists / create or replace / backfills only touch
-- rows that still need it). Deletes nothing and hides nothing.
-- (There is no 0006: Phase 2 had no schema change.)

alter table activity_entries
  add column if not exists feedback_approved_at timestamptz,
  add column if not exists feedback_approved_by text;

-- Editing visible text hides it again until re-approved. A save that also
-- changes feedback_approved_at (an approval) keeps it visible.
create or replace function hide_feedback_on_edit() returns trigger as $$
begin
  if new.display_feedback is distinct from old.display_feedback
     and old.feedback_visible and new.feedback_visible
     and new.feedback_approved_at is not distinct from old.feedback_approved_at then
    new.feedback_visible := false;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists hide_feedback_on_edit on activity_entries;
create trigger hide_feedback_on_edit before update on activity_entries
  for each row execute function hide_feedback_on_edit();

-- One-time backfill: keep the original words in raw_feedback and mark existing
-- visible entries as approved before this change. Nothing is hidden.
update activity_entries
  set raw_feedback = display_feedback
  where raw_feedback is null and display_feedback is not null;
update activity_entries
  set feedback_approved_at = created_at, feedback_approved_by = 'legacy'
  where feedback_visible and feedback_approved_at is null;
