-- Paisa: the writes and reads the management screens should not do row by row.

-- ------------------------------------------------------------- reordering --

-- One statement, one transaction. Updating each row separately costs a round
-- trip per item and can leave the order half-applied if one of them fails.
--
-- The caller sends every id in its new order; position in the array is the
-- sort_order. Ids that are not the caller's simply match nothing, so a forged
-- list cannot touch another user's rows.

create or replace function public.reorder_accounts(p_ids uuid[])
returns integer
language sql
set search_path = ''
as $$
  with updated as (
    update public.accounts a
    set sort_order = ordered.position - 1
    from unnest(p_ids) with ordinality as ordered(id, position)
    where a.id = ordered.id
      and a.user_id = (select auth.uid())
    returning 1
  )
  select count(*)::integer from updated;
$$;

create or replace function public.reorder_categories(p_ids uuid[])
returns integer
language sql
set search_path = ''
as $$
  with updated as (
    update public.categories c
    set sort_order = ordered.position - 1
    from unnest(p_ids) with ordinality as ordered(id, position)
    where c.id = ordered.id
      and c.user_id = (select auth.uid())
    returning 1
  )
  select count(*)::integer from updated;
$$;

comment on function public.reorder_accounts(uuid[]) is
  'Rewrites sort_order from the position of each id in the array. Returns how many rows moved.';
comment on function public.reorder_categories(uuid[]) is
  'Rewrites sort_order from the position of each id in the array. Returns how many rows moved.';

-- ---------------------------------------------------------- account flow ---

-- Money in and out of one account over a month, summed in the database.
-- Fetching the rows to add them up in JavaScript pulls a whole month of a
-- busy account into memory on every page render.
--
-- Both legs of a transfer count: leaving the account it is booked against,
-- arriving at the destination.
create or replace function public.account_month_flow(
  p_account_id uuid,
  p_month date
)
returns table (money_in bigint, money_out bigint)
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
      (s.month_start::timestamp at time zone s.tz) as starts_at,
      ((s.month_start + interval '1 month')::timestamp at time zone s.tz)
        as ends_at
    from settings s
  ),
  scoped as (
    select t.type, t.amount, t.account_id, t.to_account_id
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and (t.account_id = p_account_id or t.to_account_id = p_account_id)
      and t.occurred_at >= b.starts_at
      and t.occurred_at < b.ends_at
  )
  select
    coalesce(sum(s.amount) filter (
      where s.type = 'income'
         or (s.type = 'transfer' and s.to_account_id = p_account_id)
    ), 0)::bigint as money_in,
    coalesce(sum(s.amount) filter (
      where s.type = 'expense'
         or (s.type = 'transfer' and s.account_id = p_account_id)
    ), 0)::bigint as money_out
  from scoped s;
$$;

comment on function public.account_month_flow(uuid, date) is
  'Money in and out of one account during the month containing p_month, in the profile''s timezone.';

grant execute on function
  public.reorder_accounts(uuid[]),
  public.reorder_categories(uuid[]),
  public.account_month_flow(uuid, date)
to authenticated;

revoke execute on function
  public.reorder_accounts(uuid[]),
  public.reorder_categories(uuid[]),
  public.account_month_flow(uuid, date)
from anon;
