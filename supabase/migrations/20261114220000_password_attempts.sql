-- Paisa: a throttle on "is this your current password?".
--
-- Changing a password asks for the current one, and checking it means asking
-- the auth server whether a password is right. That is an oracle: someone who
-- has got hold of a session can sit on the Settings screen and guess, and a
-- stolen session that only reads data becomes a stolen account.
--
-- GoTrue rate-limits by IP, which does not help here — the guesses come from
-- the app server, so every user shares one budget and a single attacker
-- would lock everyone else out. The limit has to be per user, which means it
-- has to live next to the user.
alter table public.profiles
  add column password_attempts smallint not null default 0,
  add column password_attempt_window timestamptz;

comment on column public.profiles.password_attempts is
  'Failed current-password checks in the window; reset on success.';

-- Claimed before the password is checked, not after a failure: a request that
-- is dropped halfway must still cost the caller an attempt, or the throttle
-- is one `kill -9` away from doing nothing.
create or replace function public.claim_password_attempt()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limit constant smallint := 5;
  c_window constant interval := interval '15 minutes';
  v_user uuid := (select auth.uid());
  v_attempts smallint;
  v_window timestamptz;
begin
  if v_user is null then
    raise exception 'claim_password_attempt() needs an authenticated user'
      using errcode = '42501';
  end if;

  select pr.password_attempts, pr.password_attempt_window
    into v_attempts, v_window
  from public.profiles pr
  where pr.id = v_user
  for update;

  if v_window is null or v_window < now() - c_window then
    v_attempts := 0;
    v_window := now();
  end if;

  if v_attempts >= c_limit then
    raise exception 'too many password attempts'
      using errcode = '53400';
  end if;

  update public.profiles pr
  set password_attempts = v_attempts + 1,
      password_attempt_window = v_window
  where pr.id = v_user;

  return c_limit - (v_attempts + 1);
end;
$$;

comment on function public.claim_password_attempt() is
  'Takes one of the caller''s current-password attempts, or raises 53400 when they are spent. Returns how many are left.';

-- The counters live on a table the user may update their own row of, so
-- without this a caller could reset the count between guesses through
-- PostgREST and the limit would be decoration.
--
-- A column-level REVOKE does nothing while a table-level GRANT UPDATE is
-- held — that grant already covers every column, including ones added
-- afterwards. So the table-level grant goes, and UPDATE comes back column by
-- column. Anything not listed here is now read-only to the user: the two
-- counters, and the id and timestamps that were never theirs to set.
--
-- The security-definer functions above run as the owner, so they still write
-- the counters.
revoke update on public.profiles from authenticated, anon, public;

grant update (
  display_name,
  currency_code,
  currency_symbol,
  decimal_places,
  week_start,
  theme,
  timezone,
  last_recurring_check
) on public.profiles to authenticated;

-- There is deliberately no "clear" to call. A reset the client can ask for
-- is a reset the guesser can ask for between guesses, and the limit would be
-- decoration again. The window expiring is the only way back, which costs a
-- user who mistyped five times a quarter of an hour and costs an attacker
-- everything.
revoke execute on function public.claim_password_attempt() from public, anon;
grant execute on function public.claim_password_attempt() to authenticated;
