-- Paisa: the two budget writes that are more than one row.
--
-- Setting one month's budget is an ordinary upsert and stays in the action.
-- These two are here because they touch a run of months, and a run of months
-- half-written is worse than one not written at all.

-- ------------------------------------------------------------ set_budget --

-- Writes a category's budget for a month, and optionally carries it forward.
--
-- "Apply to all future months" stops at the first month the user has already
-- decided about: carrying £300 forward should not quietly overwrite the £900
-- someone put against December. A month that still holds the old amount is
-- considered untouched and follows along; the first one that does not ends
-- the run. That is what "until changed" means.
--
-- Twelve months is the horizon. A budget is a decision about the near future,
-- and writing rows into 2031 to express "from now on" would be a lie about
-- how certain anyone is.
create or replace function public.set_budget(
  p_category_id uuid,
  p_month date,
  p_amount bigint,
  p_apply_forward boolean default false,
  p_horizon integer default 12
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_month date := date_trunc('month', p_month::timestamp)::date;
  v_previous bigint;
  v_existing bigint;
  v_cursor date;
  v_written integer := 0;
  v_step integer;
begin
  if v_user is null then
    raise exception 'set_budget() needs an authenticated user'
      using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'a budget has to be more than zero'
      using errcode = '22023';
  end if;

  -- Read before writing: the old value is what decides which later months
  -- count as "still following this one".
  select b.amount
    into v_previous
  from public.budgets b
  where b.user_id = v_user
    and b.category_id = p_category_id
    and b.month = v_month;

  insert into public.budgets (user_id, category_id, month, amount)
  values (v_user, p_category_id, v_month, p_amount)
  on conflict (user_id, category_id, month)
  do update set amount = excluded.amount;

  v_written := 1;

  if not p_apply_forward then
    return v_written;
  end if;

  for v_step in 1..greatest(0, least(p_horizon, 60)) loop
    v_cursor := (v_month + make_interval(months => v_step))::date;

    select b.amount
      into v_existing
    from public.budgets b
    where b.user_id = v_user
      and b.category_id = p_category_id
      and b.month = v_cursor;

    -- A month that was set to something else is the user's own decision, and
    -- so is where the run ends.
    if v_existing is not null
      and (v_previous is null or v_existing <> v_previous)
    then
      exit;
    end if;

    insert into public.budgets (user_id, category_id, month, amount)
    values (v_user, p_category_id, v_cursor, p_amount)
    on conflict (user_id, category_id, month)
    do update set amount = excluded.amount;

    v_written := v_written + 1;
  end loop;

  return v_written;
end;
$$;

comment on function public.set_budget(uuid, date, bigint, boolean, integer) is
  'Sets one category''s budget for a month, optionally carrying it forward until a month that was set to something else. Returns how many months were written.';

-- --------------------------------------------- copy the previous month ----

-- Starts a month from the one before it.
--
-- Only the categories that have no budget this month are copied, so this is
-- safe to press twice, and archived categories are left out: a limit on
-- something that can no longer be chosen is a row nobody will ever look at.
create or replace function public.copy_budgets_from_previous_month(
  p_month date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_month date := date_trunc('month', p_month::timestamp)::date;
  v_copied integer;
begin
  if v_user is null then
    raise exception 'copy_budgets_from_previous_month() needs an authenticated user'
      using errcode = '42501';
  end if;

  with source as (
    select b.category_id, b.amount
    from public.budgets b
    join public.categories c
      on c.id = b.category_id
     and c.archived = false
    where b.user_id = v_user
      and b.month = (v_month - interval '1 month')::date
  ),
  inserted as (
    insert into public.budgets (user_id, category_id, month, amount)
    select v_user, s.category_id, v_month, s.amount
    from source s
    on conflict (user_id, category_id, month) do nothing
    returning 1
  )
  select count(*)::integer into v_copied from inserted;

  return v_copied;
end;
$$;

comment on function public.copy_budgets_from_previous_month(date) is
  'Copies last month''s budgets into p_month for categories that have none yet. Returns how many were copied.';

grant execute on function
  public.set_budget(uuid, date, bigint, boolean, integer),
  public.copy_budgets_from_previous_month(date)
to authenticated;

revoke execute on function
  public.set_budget(uuid, date, bigint, boolean, integer),
  public.copy_budgets_from_previous_month(date)
from anon;
