-- Paisa: changing currency without re-pricing the history.
--
-- Amounts are stored as whole minor units, so what a stored 1250 *means*
-- depends on the profile's decimal_places: ₹12.50 at two, ¥1250 at zero.
-- Changing the currency without touching the rows would silently multiply
-- every amount in the account by a hundred.
--
-- So the exponent and the rows move together, in one statement. Going to
-- fewer decimal places rounds, ₹12.50 becomes ¥13, and that is lossy and
-- cannot be undone by switching back. The UI says so before it is pressed;
-- this function's job is only to make sure the numbers and their meaning never
-- disagree.
create or replace function public.change_currency(
  p_code text,
  p_symbol text,
  p_decimals smallint
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_old smallint;
  v_factor numeric;
  v_touched integer := 0;
begin
  if v_user is null then
    raise exception 'change_currency() needs an authenticated user'
      using errcode = '42501';
  end if;

  if p_decimals < 0 or p_decimals > 3 then
    raise exception 'decimal places must be between 0 and 3'
      using errcode = '22023';
  end if;

  select pr.decimal_places into v_old
  from public.profiles pr
  where pr.id = v_user
  for update;

  if v_old is null then
    raise exception 'no profile for this user' using errcode = 'P0002';
  end if;

  update public.profiles pr
  set currency_code = p_code,
      currency_symbol = p_symbol,
      decimal_places = p_decimals
  where pr.id = v_user;

  if v_old = p_decimals then
    return 0;
  end if;

  -- 10^(new - old): greater than one when gaining decimals, a fraction when
  -- losing them. numeric throughout, rounded once at the end, so nothing is
  -- lost to binary floating point on the way.
  v_factor := power(10::numeric, (p_decimals - v_old)::numeric);

  with updated as (
    update public.transactions t
    set amount = greatest(1, round(t.amount::numeric * v_factor)::bigint)
    where t.user_id = v_user
    returning 1
  )
  select count(*)::integer into v_touched from updated;

  -- An opening balance may legitimately be zero or negative, so it is not
  -- floored the way an amount is.
  update public.accounts a
  set initial_balance = round(a.initial_balance::numeric * v_factor)::bigint
  where a.user_id = v_user;

  update public.budgets b
  set amount = greatest(1, round(b.amount::numeric * v_factor)::bigint)
  where b.user_id = v_user;

  update public.recurring_rules r
  set amount = greatest(1, round(r.amount::numeric * v_factor)::bigint)
  where r.user_id = v_user;

  return v_touched;
end;
$$;

comment on function public.change_currency(text, text, smallint) is
  'Sets the caller''s currency and rescales every stored amount when the number of decimal places changes. Returns how many transactions were rescaled.';

revoke execute on function public.change_currency(text, text, smallint)
  from public, anon;
grant execute on function public.change_currency(text, text, smallint)
  to authenticated;
