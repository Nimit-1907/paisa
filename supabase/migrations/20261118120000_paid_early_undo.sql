-- Deleting a payment made early puts it back on the schedule.
--
-- "Pay now" on an occurrence still to come records it and moves the rule's
-- next_run_on past it. Deleting that record, by Undo or by mistake, left the
-- rule moved on, so the occurrence was never created and never skipped: it
-- vanished. This moves the rule back when the deleted record's day is
-- still to come and not skipped.
--
-- Only days still to come. A payment whose day has arrived was deleted on
-- purpose, and moving the rule back would recreate it on the next page load.

create or replace function public.transactions_unpay_early()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tz text;
  v_day date;
begin
  if old.recurring_rule_id is null then
    return old;
  end if;

  -- The owner's time zone, not the caller's: the same thing user_timezone()
  -- reads, but from the row, so it holds for any path that deletes it.
  select coalesce(p.timezone, 'Asia/Kolkata') into v_tz
  from public.profiles p
  where p.id = old.user_id;
  v_tz := coalesce(v_tz, 'Asia/Kolkata');

  v_day := (old.occurred_at at time zone v_tz)::date;

  if v_day <= (now() at time zone v_tz)::date then
    return old;
  end if;

  update public.recurring_rules r
     set next_run_on = v_day
   where r.id = old.recurring_rule_id
     and r.user_id = old.user_id
     and r.next_run_on > v_day
     and not (v_day = any (r.skipped_dates));

  return old;
end;
$$;

comment on function public.transactions_unpay_early() is
  'After a rule''s record for a day still to come is deleted, puts that day back on the rule''s schedule.';

create trigger transactions_unpay_early
  after delete on public.transactions
  for each row execute function public.transactions_unpay_early();
