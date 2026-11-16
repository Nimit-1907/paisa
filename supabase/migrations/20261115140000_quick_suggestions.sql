-- Paisa: the two suggestions the app can make from what somebody already did.
--
-- Both are aggregates over months of rows, so both belong here rather than in
-- the client: shipping a user's last sixty days to the browser to count them
-- would be slower, heavier, and a worse answer than Postgres gives for free.

/*
 * The handful of things this person buys over and over.
 *
 * Grouped by category, amount and account together, because that triple is
 * what a repeat purchase actually is: "Tea ₹20 from Cash" is one habit and
 * "Tea ₹250 on the card" is a different one. Only combinations seen at least
 * three times in sixty days qualify, twice is a coincidence.
 *
 * Grouped on the exact amount, not a rounded one. Rounding to the nearest
 * whole unit would have assumed two decimal places, this app supports zero
 * to three, and it would also have offered a chip for an amount that was
 * never actually spent. A habit is a specific number: tea is ₹20, and ₹20.49
 * three times is its own habit or it is noise.
 */
create or replace function public.quick_adds()
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  amount bigint,
  account_id uuid,
  account_name text,
  used integer
)
language sql
stable
set search_path = ''
as $$
  with recent as (
    select
      t.category_id,
      t.account_id,
      t.amount
    from public.transactions t
    where t.user_id = (select auth.uid())
      and t.type = 'expense'
      and t.category_id is not null
      and t.occurred_at >= now() - interval '60 days'
  ),
  habits as (
    select
      r.category_id,
      r.account_id,
      r.amount,
      count(*)::integer as used
    from recent r
    group by r.category_id, r.account_id, r.amount
    having count(*) >= 3
  )
  select
    h.category_id,
    c.name,
    c.icon,
    c.color,
    h.amount,
    h.account_id,
    a.name as account_name,
    h.used
  from habits h
  join public.categories c on c.id = h.category_id and c.archived = false
  join public.accounts a on a.id = h.account_id and a.archived = false
  order by h.used desc, h.amount asc
  limit 6;
$$;

comment on function public.quick_adds() is
  'Up to six category/amount/account combinations seen at least three times in the last 60 days.';

revoke execute on function public.quick_adds() from public, anon;
grant execute on function public.quick_adds() to authenticated;

/*
 * What to suggest as a budget for a category.
 *
 * Last month's spend and the three-month average, both as they are: the
 * rounding to a friendly number is a presentation decision and belongs in
 * the client, next to the currency's decimal places.
 *
 * Takes the month so the suggestion is relative to the month being budgeted,
 * not to today, setting November's budget in December should still compare
 * against October.
 */
create or replace function public.budget_hints(p_month date)
returns table (
  category_id uuid,
  last_month bigint,
  three_month_average bigint
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as this_month,
      (date_trunc('month', p_month) - interval '1 month')::date as previous,
      (date_trunc('month', p_month) - interval '3 months')::date as window_start
  ),
  months as (
    select
      t.category_id,
      date_trunc('month', (t.occurred_at at time zone public.user_timezone())::date)::date as month,
      sum(t.amount)::bigint as spent
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.type = 'expense'
      and t.category_id is not null
      and (t.occurred_at at time zone public.user_timezone())::date >= b.window_start
      and (t.occurred_at at time zone public.user_timezone())::date < b.this_month
    group by 1, 2
  )
  select
    m.category_id,
    coalesce(
      max(m.spent) filter (where m.month = (select previous from bounds)),
      0
    )::bigint as last_month,
    (sum(m.spent) / 3)::bigint as three_month_average
  from months m
  group by m.category_id;
$$;

comment on function public.budget_hints(date) is
  'Last month and the three-month average spend per category, for budget suggestions.';

revoke execute on function public.budget_hints(date) from public, anon;
grant execute on function public.budget_hints(date) to authenticated;
