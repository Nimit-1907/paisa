-- Paisa: integrity triggers.
--
-- Two jobs: keep updated_at honest, and make sure a row never points at
-- another user's account or category. The second one matters even with RLS:
-- RLS decides which rows you may touch, not which ids you may write into a
-- foreign key column.
--
-- Every function sets an empty search_path and schema-qualifies its names, so
-- a rogue temp schema cannot shadow a table out from under it.

-- ----------------------------------------------------------- updated_at ----

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- clock_timestamp(), not now(): now() is the transaction's start time, so a
  -- row inserted and then edited in one transaction would keep updated_at
  -- equal to created_at and look untouched.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------ ownership checks ---

-- Deliberately SECURITY INVOKER: under RLS these lookups only see the caller's
-- own rows, so pointing at someone else's account reads as "does not exist"
-- and is rejected either way. A service-role caller sees every row and is held
-- to the explicit user_id comparison instead.

create or replace function public.check_account_owner(
  p_user_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_account_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = p_account_id
      and a.user_id = p_user_id
  ) then
    raise exception 'account % does not belong to user %',
      p_account_id, p_user_id
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.check_category_owner(
  p_user_id uuid,
  p_category_id uuid,
  p_expected_kind public.category_kind default null
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind public.category_kind;
begin
  if p_category_id is null then
    return;
  end if;

  select c.kind
    into v_kind
  from public.categories c
  where c.id = p_category_id
    and c.user_id = p_user_id;

  if v_kind is null then
    raise exception 'category % does not belong to user %',
      p_category_id, p_user_id
      using errcode = '42501';
  end if;

  if p_expected_kind is not null and v_kind <> p_expected_kind then
    raise exception 'category % is a % category, expected %',
      p_category_id, v_kind, p_expected_kind
      using errcode = '23514';
  end if;
end;
$$;

-- Transactions and recurring rules share a shape, so they share this check.
create or replace function public.check_entry_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected_kind public.category_kind;
begin
  perform public.check_account_owner(new.user_id, new.account_id);
  perform public.check_account_owner(new.user_id, new.to_account_id);

  -- An income row needs an income category, an expense row an expense one.
  v_expected_kind := case new.type
    when 'income' then 'income'::public.category_kind
    when 'expense' then 'expense'::public.category_kind
    else null
  end;

  perform public.check_category_owner(
    new.user_id, new.category_id, v_expected_kind
  );

  return new;
end;
$$;

create trigger transactions_check_refs
  before insert or update of user_id, type, account_id, to_account_id, category_id
  on public.transactions
  for each row execute function public.check_entry_refs();

create trigger recurring_rules_check_refs
  before insert or update of user_id, type, account_id, to_account_id, category_id
  on public.recurring_rules
  for each row execute function public.check_entry_refs();

create or replace function public.check_transaction_rule_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recurring_rule_id is not null and not exists (
    select 1
    from public.recurring_rules r
    where r.id = new.recurring_rule_id
      and r.user_id = new.user_id
  ) then
    raise exception 'recurring rule % does not belong to user %',
      new.recurring_rule_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger transactions_check_rule_owner
  before insert or update of user_id, recurring_rule_id
  on public.transactions
  for each row execute function public.check_transaction_rule_owner();

create or replace function public.check_budget_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.check_category_owner(
    new.user_id, new.category_id, 'expense'::public.category_kind
  );
  return new;
end;
$$;

create trigger budgets_check_refs
  before insert or update of user_id, category_id
  on public.budgets
  for each row execute function public.check_budget_refs();
