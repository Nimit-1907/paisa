-- Deleting a payment made early also takes it off "Last created".
--
-- 20261118120000 moved next_run_on back when an early payment was deleted,
-- but left last_run_on on the deleted day. The rule then read "Last created
-- Thu, 19 Nov" beside "Next on 19 Nov": a record that no longer exists.
-- last_run_on now falls back to the latest record the rule still has.

create or replace function public.transactions_unpay_early()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tz text;
  v_day date;
  v_last date;
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

  -- The record is already gone (after delete), so this is what is left.
  select max((t.occurred_at at time zone v_tz)::date) into v_last
  from public.transactions t
  where t.recurring_rule_id = old.recurring_rule_id
    and t.user_id = old.user_id;

  update public.recurring_rules r
     set next_run_on = v_day,
         last_run_on = case
           when r.last_run_on >= v_day then v_last
           else r.last_run_on
         end
   where r.id = old.recurring_rule_id
     and r.user_id = old.user_id
     and r.next_run_on > v_day
     and not (v_day = any (r.skipped_dates));

  return old;
end;
$$;
