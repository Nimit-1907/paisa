-- Paisa: carry the tint out of the functions that draw tiles.
--
-- `category_totals` feeds the Analysis donut and its legend, and `quick_adds`
-- feeds the chips on the Add Record sheet. Both already returned `color`, and
-- since Phase 14 every tile on screen is a tint rather than a hex, so both
-- have to return it, or those two screens are the only ones left drawing
-- grey tiles.
--
-- `color` stays in the signature beside it. Removing a column from a function
-- that a deployed client still selects is a runtime error for anybody who has
-- not reloaded; adding one is not.

drop function if exists public.category_totals(
  date, date, public.category_kind
);

create function public.category_totals(
  p_from date,
  p_to date,
  p_kind public.category_kind
)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  tint public.tint,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select * from public.local_day_range(p_from, p_to)
  )
  select
    c.id,
    c.name,
    c.icon,
    c.color,
    c.tint,
    sum(t.amount)::bigint as total
  from public.transactions t
  join public.categories c on c.id = t.category_id
  cross join bounds b
  where t.user_id = (select auth.uid())
    -- A transfer has no category and belongs to neither side of this split.
    and t.type = (p_kind::text)::public.transaction_type
    and t.occurred_at >= b.starts_at
    and t.occurred_at < b.ends_at
  group by c.id, c.name, c.icon, c.color, c.tint
  order by sum(t.amount) desc, c.name;
$$;

comment on function public.category_totals(date, date, public.category_kind) is
  'Income or expense per category between two local dates, inclusive, biggest first.';

drop function if exists public.quick_adds();

create function public.quick_adds()
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  tint public.tint,
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
    c.tint,
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
  'The things this person buys over and over, as one-tap chips.';

revoke all on function public.category_totals(date, date, public.category_kind)
  from public;
grant execute on function public.category_totals(date, date, public.category_kind)
  to authenticated;

revoke all on function public.quick_adds() from public;
grant execute on function public.quick_adds() to authenticated;
