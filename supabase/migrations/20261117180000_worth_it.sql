-- "Worth it?" on a spend.
--
-- One tap on a record says whether the money was well spent: true is worth
-- it, false is a regret, null is not said. Only a spend can carry it; a
-- record's type is fixed once saved (20261116150000), so a check is enough
-- and no trigger has to clear it.

alter table public.transactions
  add column worth_it boolean;

alter table public.transactions
  add constraint transactions_worth_it_expense_only
  check (worth_it is null or type = 'expense');

comment on column public.transactions.worth_it is
  'true: worth it; false: regretted; null: not said. Spends only.';

-- What was regretted in the month containing p_month, in the user's own
-- time zone, the same month bounds as month_summary.
create or replace function public.month_regret(p_month date)
returns bigint
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      (date_trunc('month', p_month::timestamp)::timestamp
        at time zone public.user_timezone()) as starts_at,
      ((date_trunc('month', p_month::timestamp) + interval '1 month')::timestamp
        at time zone public.user_timezone()) as ends_at
  )
  select coalesce(sum(t.amount), 0)::bigint
  from public.transactions t, bounds b
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.worth_it = false
    and t.occurred_at >= b.starts_at
    and t.occurred_at < b.ends_at;
$$;

comment on function public.month_regret(date) is
  'Total of the spends marked as regretted in the month containing p_month.';

grant execute on function public.month_regret(date) to authenticated;
revoke execute on function public.month_regret(date) from anon;
