-- Paisa: saving the settings form in one go.
--
-- The form changes four things at once, and one of them — the currency — can
-- rewrite every amount the user owns. Doing that as two round trips means a
-- window where the amounts have been rescaled and the name has not, and the
-- screen says the save failed. One function is one transaction: either the
-- whole form lands or none of it does.
create or replace function public.update_settings(
  p_display_name text,
  p_week_start smallint,
  p_theme text,
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
  v_rescaled integer := 0;
begin
  if v_user is null then
    raise exception 'update_settings() needs an authenticated user'
      using errcode = '42501';
  end if;

  if p_week_start < 0 or p_week_start > 6 then
    raise exception 'week start must be 0 (Sunday) to 6 (Saturday)'
      using errcode = '22023';
  end if;

  if p_theme not in ('light', 'dark', 'system') then
    raise exception 'unknown theme %', p_theme using errcode = '22023';
  end if;

  update public.profiles pr
  set display_name = p_display_name,
      week_start = p_week_start,
      theme = p_theme
  where pr.id = v_user;

  if not found then
    raise exception 'no profile for this user' using errcode = 'P0002';
  end if;

  -- Does the currency work and the rescaling, and returns early when the
  -- exponent has not moved.
  v_rescaled := public.change_currency(p_code, p_symbol, p_decimals);

  return v_rescaled;
end;
$$;

comment on function public.update_settings(text, smallint, text, text, text, smallint) is
  'Saves the whole settings form in one transaction. Returns how many transactions the currency change rescaled.';

revoke execute on function
  public.update_settings(text, smallint, text, text, text, smallint)
  from public, anon;
grant execute on function
  public.update_settings(text, smallint, text, text, text, smallint)
  to authenticated;
