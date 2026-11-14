-- Paisa: the read models and the two RPCs the app calls.

-- ------------------------------------------------------- user timezone ----

create or replace function public.user_timezone()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select p.timezone from public.profiles p where p.id = (select auth.uid())),
    'Asia/Kolkata'
  );
$$;

comment on function public.user_timezone() is
  'The caller profile''s timezone, used to decide which day/month a timestamp belongs to.';

-- ------------------------------------------------------ account balances ---

-- security_invoker: the view runs with the caller's permissions, so the RLS
-- policies on accounts and transactions apply. Without it the view would
-- happily hand one user another user's balances.
create view public.account_balances
with (security_invoker = true)
as
with movements as (
  -- Money leaving the account it is booked against: expenses and the outgoing
  -- leg of a transfer. Income adds to it.
  select
    t.user_id,
    t.account_id,
    case when t.type = 'income' then t.amount else -t.amount end as delta
  from public.transactions t

  union all

  -- The incoming leg of a transfer.
  select
    t.user_id,
    t.to_account_id as account_id,
    t.amount as delta
  from public.transactions t
  where t.type = 'transfer'
    and t.to_account_id is not null
)
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.icon,
  a.color,
  a.include_in_total,
  a.archived,
  a.sort_order,
  a.initial_balance,
  (a.initial_balance + coalesce(sum(m.delta), 0))::bigint as balance,
  count(m.delta)::integer as movement_count
from public.accounts a
left join movements m
  on m.account_id = a.id
 and m.user_id = a.user_id
group by a.id;

comment on view public.account_balances is
  'Per-account current balance: initial_balance + income - expense - transfers out + transfers in.';

grant select on table public.account_balances to authenticated;
revoke all on table public.account_balances from anon;

-- -------------------------------------------------------- month summary ----

create or replace function public.month_summary(p_month date)
returns table (
  month_start date,
  total_income bigint,
  total_expense bigint,
  net bigint,
  categories jsonb
)
language sql
stable
set search_path = ''
as $$
  with settings as (
    select
      public.user_timezone() as tz,
      date_trunc('month', p_month::timestamp)::date as month_start
  ),
  bounds as (
    select
      s.month_start,
      -- Compared as timestamptz so the index on (user_id, occurred_at) is
      -- usable, and so a 11pm IST purchase on the 31st stays in its month.
      (s.month_start::timestamp at time zone s.tz) as starts_at,
      ((s.month_start + interval '1 month')::timestamp at time zone s.tz)
        as ends_at
    from settings s
  ),
  scoped as (
    select t.*
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.occurred_at >= b.starts_at
      and t.occurred_at < b.ends_at
  ),
  totals as (
    select
      coalesce(sum(s.amount) filter (where s.type = 'income'), 0)::bigint
        as total_income,
      coalesce(sum(s.amount) filter (where s.type = 'expense'), 0)::bigint
        as total_expense
    from scoped s
  ),
  by_category as (
    select
      c.id,
      c.name,
      c.icon,
      c.color,
      sum(s.amount)::bigint as total
    from scoped s
    join public.categories c on c.id = s.category_id
    where s.type = 'expense'
    group by c.id, c.name, c.icon, c.color
  )
  select
    b.month_start,
    t.total_income,
    t.total_expense,
    (t.total_income - t.total_expense)::bigint as net,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category_id', bc.id,
            'name', bc.name,
            'icon', bc.icon,
            'color', bc.color,
            'total', bc.total
          )
          order by bc.total desc, bc.name
        )
        from by_category bc
      ),
      '[]'::jsonb
    ) as categories
  from totals t, bounds b;
$$;

comment on function public.month_summary(date) is
  'Income/expense/net for the month containing p_month, plus expense totals per category.';

grant execute on function public.month_summary(date) to authenticated;
revoke execute on function public.month_summary(date) from anon;

-- --------------------------------------------------- recurring processing --

-- The nth occurrence of a rule, always measured from its start date.
--
-- Stepping a cursor forward instead would compound month clamping: a monthly
-- rule starting on the 31st would go 31 Jan, 28 Feb, 28 Mar, 28 Apr … and
-- never find its way back to the 31st. Anchoring on the start date gives
-- 31 Jan, 28 Feb, 31 Mar, 30 Apr, which is what "monthly on the 31st" means.
create or replace function public.recurrence_occurrence(
  p_start date,
  p_frequency public.recurrence_frequency,
  p_interval integer,
  p_n integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select (
    p_start + case p_frequency
      when 'daily' then make_interval(days => p_interval * p_n)
      when 'weekly' then make_interval(weeks => p_interval * p_n)
      when 'monthly' then make_interval(months => p_interval * p_n)
      when 'yearly' then make_interval(years => p_interval * p_n)
    end
  )::date;
$$;

grant execute on function public.recurrence_occurrence(
  date, public.recurrence_frequency, integer, integer
) to authenticated;

create or replace function public.process_due_recurring()
returns table (
  rule_id uuid,
  created_count integer,
  next_run_on date
)
language plpgsql
set search_path = ''
as $$
declare
  -- Safety net for a rule whose start_date is years in the past: stop after
  -- this many, keep the advanced cursor, and let the next call carry on.
  c_max_per_rule constant integer := 500;
  v_user uuid := (select auth.uid());
  v_tz text;
  v_today date;
  v_rule record;
  v_cursor date;
  v_n integer;
  v_created integer;
begin
  if v_user is null then
    raise exception 'process_due_recurring() needs an authenticated user'
      using errcode = '42501';
  end if;

  v_tz := public.user_timezone();
  v_today := (now() at time zone v_tz)::date;

  for v_rule in
    select r.*
    from public.recurring_rules r
    where r.user_id = v_user
      and r.active
      and r.next_run_on <= v_today
    order by r.next_run_on, r.id
    for update
  loop
    -- Where next_run_on sits on the rule's own schedule. The estimate is
    -- exact for daily and weekly and at most one step short for monthly and
    -- yearly, which the loop below settles.
    v_n := greatest(0, case v_rule.frequency
      when 'daily' then
        (v_rule.next_run_on - v_rule.start_date) / v_rule.interval_count
      when 'weekly' then
        (v_rule.next_run_on - v_rule.start_date) / (7 * v_rule.interval_count)
      when 'monthly' then
        ((extract(year from v_rule.next_run_on) * 12
            + extract(month from v_rule.next_run_on))
         - (extract(year from v_rule.start_date) * 12
            + extract(month from v_rule.start_date)))::integer
        / v_rule.interval_count
      when 'yearly' then
        (extract(year from v_rule.next_run_on)
         - extract(year from v_rule.start_date))::integer
        / v_rule.interval_count
    end);

    while public.recurrence_occurrence(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count, v_n
    ) < v_rule.next_run_on loop
      v_n := v_n + 1;
    end loop;

    v_cursor := public.recurrence_occurrence(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count, v_n
    );
    v_created := 0;

    -- Catch up every occurrence that was missed while the app was closed.
    while v_cursor <= v_today
      and (v_rule.end_date is null or v_cursor <= v_rule.end_date)
      and v_created < c_max_per_rule
    loop
      insert into public.transactions (
        user_id, type, amount, account_id, to_account_id, category_id,
        note, occurred_at, recurring_rule_id
      )
      values (
        v_user,
        v_rule.type,
        v_rule.amount,
        v_rule.account_id,
        v_rule.to_account_id,
        v_rule.category_id,
        v_rule.note,
        -- Midday local time: far enough from either midnight that a timezone
        -- rounding never moves the row into the neighbouring day.
        ((v_cursor + time '12:00')::timestamp at time zone v_tz),
        v_rule.id
      );

      v_created := v_created + 1;
      v_n := v_n + 1;
      v_cursor := public.recurrence_occurrence(
        v_rule.start_date, v_rule.frequency, v_rule.interval_count, v_n
      );
    end loop;

    -- Idempotent: the cursor now sits in the future, so a second call in the
    -- same day selects nothing for this rule.
    update public.recurring_rules r
    set
      next_run_on = v_cursor,
      active = case
        when r.end_date is not null and v_cursor > r.end_date then false
        else r.active
      end
    where r.id = v_rule.id;

    rule_id := v_rule.id;
    created_count := v_created;
    next_run_on := v_cursor;
    return next;
  end loop;
end;
$$;

comment on function public.process_due_recurring() is
  'Creates the transactions every active rule of the caller owes up to today, then advances next_run_on. Safe to call repeatedly.';

grant execute on function public.process_due_recurring() to authenticated;
revoke execute on function public.process_due_recurring() from anon;
