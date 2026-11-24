-- Cancelled listings. Run by hand in the Supabase SQL editor BEFORE deploying
-- the code that uses it. Safe to re-run. Deletes no rows or columns.
--
-- status = 'cancelled' with cancelled_date: days on market stop on that date,
-- weekly emails stop, and the seller page stays up. Relisting (back to
-- 'active' with a new list_date) adds the cancelled period to
-- prior_days_on_market in the app and clears cancelled_date.

alter table listings add column if not exists cancelled_date date;

-- Allow 'cancelled' in any existing check constraint on listings.status:
-- drop the old status check (if there is one) and add one that includes it.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'listings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and conname <> 'listings_status_check_v2'
  loop
    execute format('alter table listings drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'listings'::regclass and conname = 'listings_status_check_v2') then
    alter table listings add constraint listings_status_check_v2
      check (status in ('prepping', 'active', 'pending', 'sold', 'cancelled'));
  end if;
end $$;
