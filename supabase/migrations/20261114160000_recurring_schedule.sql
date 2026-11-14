-- Paisa: recurring transactions that hold their anchor and never duplicate.
--
-- Three things were missing from the first cut:
--
--   * an anchor. "Monthly on the 31st" has to clamp to 28 February and then
--     come back to 31 March. Anchoring on start_date got that right only when
--     the start day *was* the anchor day; editing a rule's start date moved
--     the whole schedule with it.
--   * a record of what was skipped or last run, so "skip next month" is a
--     decision the rule remembers rather than a one-off edit of next_run_on.
--   * a uniqueness guarantee. Catch-up runs on page load, two tabs can race,
--     and a retried request must not double-charge the user's month. One
--     occurrence per rule per day, enforced by an index rather than by hoping
--     the cursor arithmetic is right.

-- ----------------------------------------------------------- new columns ---

alter table public.recurring_rules
  -- Nullable only momentarily: the trigger below fills it from start_date, so
  -- every row has one and the UI can always say "monthly on day 31".
  add column anchor_day smallint check (anchor_day between 1 and 31),
  add column last_run_on date,
  -- Occurrences the user has skipped. Kept as dates rather than a count, so
  -- skipping February does not quietly shift March.
  add column skipped_dates date[] not null default '{}';

update public.recurring_rules
set anchor_day = extract(day from start_date)::smallint
where anchor_day is null;

comment on column public.recurring_rules.anchor_day is
  'Day of the month a monthly/yearly rule aims at, clamped to shorter months. Ignored by daily and weekly rules.';
comment on column public.recurring_rules.last_run_on is
  'The occurrence date most recently materialised, for display and support.';
comment on column public.recurring_rules.skipped_dates is
  'Occurrence dates the user chose to skip; the generator passes over them.';

alter table public.profiles
  add column last_recurring_check date;

comment on column public.profiles.last_recurring_check is
  'The last local date on which the app ran the recurring generator for this user.';

-- The anchor follows the start day unless the caller sets it in the same
-- statement — editing "starts on the 3rd" to "starts on the 31st" should move
-- the anchor too, while an explicit anchor always wins.
create or replace function public.set_recurrence_anchor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.anchor_day is null then
    new.anchor_day := extract(day from new.start_date)::smallint;
  elsif tg_op = 'UPDATE'
    and new.start_date <> old.start_date
    and new.anchor_day = old.anchor_day
  then
    new.anchor_day := extract(day from new.start_date)::smallint;
  end if;

  return new;
end;
$$;

create trigger recurring_rules_set_anchor
  before insert or update of start_date, anchor_day
  on public.recurring_rules
  for each row execute function public.set_recurrence_anchor();

-- --------------------------------------------------------- no duplicates ---

-- One transaction per rule per occurrence day. This is what makes the
-- generator safe to call from a page render: two tabs opening at once, a
-- retried request and a cursor that was already advanced all end up colliding
-- here instead of creating a second rent payment.
--
-- The day is read in UTC because an index expression must be immutable, and
-- `occurred_at::date` depends on the session's TimeZone. Generated rows are
-- written at midday local time, so their UTC day is a stable label for the
-- occurrence in every timezone — it is only ever compared with itself.
create unique index transactions_recurring_day_key
  on public.transactions (recurring_rule_id, ((occurred_at at time zone 'UTC')::date))
  where recurring_rule_id is not null;

-- --------------------------------------------------------- the arithmetic --

-- The nth occurrence of a rule, measured from its start date and placed on
-- the anchor day.
--
-- Stepping a cursor forward instead would compound the clamping: a monthly
-- rule on the 31st would go 31 Jan, 28 Feb, 28 Mar, 28 Apr and never find its
-- way back. Anchoring gives 31 Jan, 28 Feb, 31 Mar, 30 Apr, which is what
-- "monthly on the 31st" means — and the same trick carries 29 February
-- through three common years to the next leap one.
create or replace function public.recurrence_occurrence(
  p_start date,
  p_frequency public.recurrence_frequency,
  p_interval integer,
  p_n integer,
  p_anchor_day smallint
)
returns date
language sql
immutable
set search_path = ''
as $$
  with stepped as (
    select case p_frequency
      when 'daily' then p_start + make_interval(days => p_interval * p_n)
      when 'weekly' then p_start + make_interval(weeks => p_interval * p_n)
      when 'monthly' then p_start + make_interval(months => p_interval * p_n)
      when 'yearly' then p_start + make_interval(years => p_interval * p_n)
    end::date as moved
  ),
  anchored as (
    select
      s.moved,
      date_trunc('month', s.moved::timestamp)::date as month_start,
      extract(
        day from (date_trunc('month', s.moved::timestamp)
                  + interval '1 month - 1 day')
      )::smallint as days_in_month
    from stepped s
  )
  select case
    when p_frequency in ('daily', 'weekly') then a.moved
    else a.month_start
         + (least(
              coalesce(p_anchor_day, extract(day from p_start)::smallint),
              a.days_in_month
            ) - 1)
    end
  from anchored a;
$$;

-- The 4-argument form the first migration shipped, kept so anything still
-- calling it keeps working: no anchor means "anchor on the start day".
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
  select public.recurrence_occurrence(
    p_start, p_frequency, p_interval, p_n, null::smallint
  );
$$;

-- The first occurrence on or after p_from.
--
-- The estimate is exact for daily and weekly and at most one step short for
-- monthly and yearly (a clamped month can land before the anchor), so the
-- loop settles it. Both directions are walked because an edited start_date
-- can leave next_run_on off the schedule entirely.
create or replace function public.recurrence_after(
  p_start date,
  p_frequency public.recurrence_frequency,
  p_interval integer,
  p_anchor_day smallint,
  p_from date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n integer;
  v_date date;
begin
  v_n := greatest(0, case p_frequency
    when 'daily' then (p_from - p_start) / p_interval
    when 'weekly' then (p_from - p_start) / (7 * p_interval)
    when 'monthly' then
      ((extract(year from p_from) * 12 + extract(month from p_from))
       - (extract(year from p_start) * 12 + extract(month from p_start)))::integer
      / p_interval
    when 'yearly' then
      (extract(year from p_from) - extract(year from p_start))::integer
      / p_interval
  end);

  v_date := public.recurrence_occurrence(
    p_start, p_frequency, p_interval, v_n, p_anchor_day
  );

  while v_date < p_from loop
    v_n := v_n + 1;
    v_date := public.recurrence_occurrence(
      p_start, p_frequency, p_interval, v_n, p_anchor_day
    );
  end loop;

  while v_n > 0 loop
    if public.recurrence_occurrence(
      p_start, p_frequency, p_interval, v_n - 1, p_anchor_day
    ) < p_from then
      exit;
    end if;
    v_n := v_n - 1;
    v_date := public.recurrence_occurrence(
      p_start, p_frequency, p_interval, v_n, p_anchor_day
    );
  end loop;

  return v_date;
end;
$$;

grant execute on function public.recurrence_occurrence(
  date, public.recurrence_frequency, integer, integer, smallint
) to authenticated;

grant execute on function public.recurrence_after(
  date, public.recurrence_frequency, integer, smallint, date
) to authenticated;

-- ------------------------------------------------------------ the engine ---

-- Returns how many transactions it created, so the app can say
-- "3 recurring records added" rather than guessing.
drop function if exists public.process_due_recurring();

create function public.process_due_recurring()
returns integer
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
  v_last date;
  v_steps integer;
  v_id uuid;
  v_created integer := 0;
begin
  if v_user is null then
    raise exception 'process_due_recurring() needs an authenticated user'
      using errcode = '42501';
  end if;

  v_tz := public.user_timezone();
  v_today := (now() at time zone v_tz)::date;

  -- A rule that is past its end date *and* has nothing left to produce can
  -- be switched off straight away, so the Paused list tells the truth even
  -- for a rule that was never due again in the first place.
  --
  -- The next_run_on test is what keeps this honest: a rule that ended while
  -- the app was closed still owes every occurrence up to its end date, and
  -- deactivating it here would lose them. Those rules go through the loop
  -- below and switch themselves off at the end of it.
  update public.recurring_rules r
  set active = false
  where r.user_id = v_user
    and r.active
    and r.end_date is not null
    and r.end_date < v_today
    and r.next_run_on > r.end_date;

  for v_rule in
    select r.*
    from public.recurring_rules r
    where r.user_id = v_user
      and r.active
      and r.next_run_on <= v_today
    order by r.next_run_on, r.id
    for update
  loop
    -- Snapped onto the rule's own schedule: next_run_on is a cursor, and an
    -- edited start date or anchor can leave it between two occurrences.
    v_cursor := public.recurrence_after(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.anchor_day, v_rule.next_run_on
    );
    v_last := null;
    v_steps := 0;

    -- Catch up every occurrence that was missed while the app was closed.
    while v_cursor <= v_today
      and (v_rule.end_date is null or v_cursor <= v_rule.end_date)
      and v_steps < c_max_per_rule
    loop
      if not (v_cursor = any (v_rule.skipped_dates)) then
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
          -- Midday local time: far enough from either midnight that a
          -- timezone rounding never moves the row into the neighbouring day.
          ((v_cursor + time '12:00')::timestamp at time zone v_tz),
          v_rule.id
        )
        -- The index does the deciding. A second caller racing this one, or a
        -- cursor that was already advanced, finds the row already there and
        -- moves on instead of writing a duplicate.
        on conflict do nothing
        returning id into v_id;

        if v_id is not null then
          v_created := v_created + 1;
          v_last := v_cursor;
        end if;
      end if;

      v_steps := v_steps + 1;
      v_cursor := public.recurrence_after(
        v_rule.start_date, v_rule.frequency, v_rule.interval_count,
        v_rule.anchor_day, v_cursor + 1
      );
    end loop;

    -- Idempotent: the cursor now sits in the future, so a second call in the
    -- same day selects nothing for this rule.
    update public.recurring_rules r
    set
      next_run_on = v_cursor,
      last_run_on = coalesce(v_last, r.last_run_on),
      active = case
        when r.end_date is not null and v_cursor > r.end_date then false
        else r.active
      end
    where r.id = v_rule.id;
  end loop;

  return v_created;
end;
$$;

comment on function public.process_due_recurring() is
  'Creates the transactions every active rule of the caller owes up to today, then advances next_run_on. Returns how many it created. Safe to call repeatedly.';

grant execute on function public.process_due_recurring() to authenticated;
revoke execute on function public.process_due_recurring() from anon;

-- --------------------------------------------------------------- pay now ---

-- Materialises one occurrence early and moves the rule past it.
--
-- The transaction keeps the occurrence's own date rather than today's: it is
-- the 1 December rent, paid on 28 November, and dating it today would both
-- file it in the wrong month and leave the occurrence free to be generated
-- again next week.
create or replace function public.materialise_recurring(
  p_rule_id uuid,
  p_on date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tz text;
  v_rule public.recurring_rules;
  v_scheduled date;
  v_cursor date;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'materialise_recurring() needs an authenticated user'
      using errcode = '42501';
  end if;

  select * into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id
    and r.user_id = v_user
  for update;

  if v_rule.id is null then
    raise exception 'no such recurring rule' using errcode = 'P0002';
  end if;

  -- p_on arrives from a button in a list that may be a few minutes old, so
  -- it is checked against the schedule rather than trusted.
  v_scheduled := public.recurrence_after(
    v_rule.start_date, v_rule.frequency, v_rule.interval_count,
    v_rule.anchor_day, p_on
  );

  if v_scheduled <> p_on then
    raise exception '% is not an occurrence of this rule', p_on
      using errcode = '22023';
  end if;

  if v_rule.end_date is not null and p_on > v_rule.end_date then
    raise exception 'that occurrence is past the rule''s end date'
      using errcode = '22023';
  end if;

  if p_on = any (v_rule.skipped_dates) then
    raise exception 'that occurrence was skipped' using errcode = '22023';
  end if;

  -- Where the rule is actually pointing, skipping over anything the user has
  -- already said no to.
  v_cursor := public.recurrence_after(
    v_rule.start_date, v_rule.frequency, v_rule.interval_count,
    v_rule.anchor_day, v_rule.next_run_on
  );

  while v_cursor < p_on and v_cursor = any (v_rule.skipped_dates) loop
    v_cursor := public.recurrence_after(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.anchor_day, v_cursor + 1
    );
  end loop;

  v_tz := public.user_timezone();

  insert into public.transactions (
    user_id, type, amount, account_id, to_account_id, category_id,
    note, occurred_at, recurring_rule_id
  )
  values (
    v_user, v_rule.type, v_rule.amount, v_rule.account_id,
    v_rule.to_account_id, v_rule.category_id, v_rule.note,
    ((p_on + time '12:00')::timestamp at time zone v_tz),
    v_rule.id
  )
  on conflict do nothing
  returning id into v_id;

  -- The cursor only moves when the occurrence paid *is* the one the rule was
  -- waiting on. Paying something further out — the second item in a week's
  -- list, say — must not step over an occurrence that is still owed, which
  -- would make it disappear without ever being created or skipped. Those are
  -- left for the generator, and the unique index stops this one being made
  -- twice when it gets there.
  if p_on = v_cursor then
    update public.recurring_rules r
    set
      next_run_on = public.recurrence_after(
        r.start_date, r.frequency, r.interval_count, r.anchor_day, p_on + 1
      ),
      last_run_on = greatest(coalesce(r.last_run_on, p_on), p_on),
      active = case
        when r.end_date is not null
          and public.recurrence_after(
                r.start_date, r.frequency, r.interval_count, r.anchor_day,
                p_on + 1
              ) > r.end_date
        then false
        else r.active
      end
    where r.id = p_rule_id;
  else
    update public.recurring_rules r
    set last_run_on = greatest(coalesce(r.last_run_on, p_on), p_on)
    where r.id = p_rule_id;
  end if;

  return v_id;
end;
$$;

comment on function public.materialise_recurring(uuid, date) is
  'Creates one occurrence of a rule ahead of schedule and advances the rule past it. Returns the transaction id, or null if it already existed.';

-- ------------------------------------------------------------------ skip ---

-- Skips an occurrence: remembered on the rule, so catch-up will not create it
-- later, and the cursor moves to the one after.
create or replace function public.skip_recurring_occurrence(
  p_rule_id uuid,
  p_on date
)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_rule public.recurring_rules;
  v_scheduled date;
  v_cursor date;
  v_next date;
begin
  if v_user is null then
    raise exception 'skip_recurring_occurrence() needs an authenticated user'
      using errcode = '42501';
  end if;

  select * into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id
    and r.user_id = v_user
  for update;

  if v_rule.id is null then
    raise exception 'no such recurring rule' using errcode = 'P0002';
  end if;

  v_scheduled := public.recurrence_after(
    v_rule.start_date, v_rule.frequency, v_rule.interval_count,
    v_rule.anchor_day, p_on
  );

  if v_scheduled <> p_on then
    raise exception '% is not an occurrence of this rule', p_on
      using errcode = '22023';
  end if;

  v_cursor := public.recurrence_after(
    v_rule.start_date, v_rule.frequency, v_rule.interval_count,
    v_rule.anchor_day, v_rule.next_run_on
  );

  while v_cursor < p_on and v_cursor = any (v_rule.skipped_dates) loop
    v_cursor := public.recurrence_after(
      v_rule.start_date, v_rule.frequency, v_rule.interval_count,
      v_rule.anchor_day, v_cursor + 1
    );
  end loop;

  v_next := public.recurrence_after(
    v_rule.start_date, v_rule.frequency, v_rule.interval_count,
    v_rule.anchor_day, p_on + 1
  );

  update public.recurring_rules r
  set
    -- Appended only once, so skipping the same date twice is not an error.
    skipped_dates = case
      when p_on = any (r.skipped_dates) then r.skipped_dates
      else r.skipped_dates || p_on
    end,
    -- Same rule as paying early: the cursor moves only when the skipped
    -- occurrence is the one the rule was waiting on. Skipping December must
    -- not step over a November that is still owed — the skip is remembered,
    -- and the generator passes over it when it reaches that date.
    next_run_on = case when p_on = v_cursor then v_next else r.next_run_on end,
    active = case
      when p_on = v_cursor and r.end_date is not null and v_next > r.end_date
      then false
      else r.active
    end
  where r.id = p_rule_id;

  return case when p_on = v_cursor then v_next else v_rule.next_run_on end;
end;
$$;

comment on function public.skip_recurring_occurrence(uuid, date) is
  'Marks one occurrence as skipped and moves the rule to the next one. Returns the new next_run_on.';

-- ----------------------------------------------------------------- delete --

-- Deleting a rule, with or without the records it already created.
--
-- transactions.recurring_rule_id is ON DELETE SET NULL, so "keep past
-- records" is the default behaviour of a plain delete; this wraps both
-- choices in one statement so the records cannot be half-removed.
create or replace function public.delete_recurring_rule(
  p_rule_id uuid,
  p_delete_transactions boolean default false
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_deleted integer := 0;
begin
  if v_user is null then
    raise exception 'delete_recurring_rule() needs an authenticated user'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.recurring_rules r
    where r.id = p_rule_id and r.user_id = v_user
  ) then
    raise exception 'no such recurring rule' using errcode = 'P0002';
  end if;

  if p_delete_transactions then
    with removed as (
      delete from public.transactions t
      where t.recurring_rule_id = p_rule_id
        and t.user_id = v_user
      returning 1
    )
    select count(*)::integer into v_deleted from removed;
  end if;

  delete from public.recurring_rules r
  where r.id = p_rule_id
    and r.user_id = v_user;

  return v_deleted;
end;
$$;

comment on function public.delete_recurring_rule(uuid, boolean) is
  'Deletes a rule; optionally deletes the transactions it created. Returns how many transactions went with it.';

grant execute on function
  public.materialise_recurring(uuid, date),
  public.skip_recurring_occurrence(uuid, date),
  public.delete_recurring_rule(uuid, boolean)
to authenticated;

revoke execute on function
  public.materialise_recurring(uuid, date),
  public.skip_recurring_occurrence(uuid, date),
  public.delete_recurring_rule(uuid, boolean)
from anon;

-- ------------------------------------------------------------- rule usage --

-- How many records each rule has created, for the delete dialog: "keep past
-- records" has to be able to say how many that is, and counting them in the
-- client would mean fetching every transaction to find out.
create view public.recurring_rule_usage
with (security_invoker = true)
as
select
  r.id as rule_id,
  r.user_id,
  (
    select count(*)
    from public.transactions t
    where t.recurring_rule_id = r.id
  )::integer as transaction_count
from public.recurring_rules r;

comment on view public.recurring_rule_usage is
  'Per recurring rule: how many transactions it has created.';

grant select on table public.recurring_rule_usage to authenticated;
revoke all on table public.recurring_rule_usage from anon;
