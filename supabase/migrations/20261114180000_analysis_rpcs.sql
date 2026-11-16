-- Paisa: the reads behind the charts.
--
-- Every one of these is a grouping over a date range, and every one is
-- evaluated in the profile's timezone so a late-evening purchase lands on the
-- day the user thinks it did, the same rule month_summary follows, because a
-- chart that disagrees with the record list is worse than no chart.
--
-- The ranges are inclusive of both ends: callers pass local calendar days,
-- and "1 to 30 November" should mean all of the 30th.

-- --------------------------------------------------------- shared bounds --

-- How far apart two dates may be before the answer stops being a chart.
-- Ten years of daily rows is 3,653 of them; anything past that is a caller
-- with a typo or someone poking the API by hand, and either way the right
-- answer is to say no rather than to tie up a database worker.
create or replace function public.assert_range(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_to < p_from then
    raise exception 'the range ends before it starts: % to %', p_from, p_to
      using errcode = '22023';
  end if;

  if p_to - p_from > 3653 then
    raise exception 'a range of % days is too long', p_to - p_from
      using errcode = '22023';
  end if;
end;
$$;

-- The bucket rules, in one place: both series functions ask the same
-- questions, and two copies of a limit is one copy too many.
create or replace function public.assert_bucket(
  p_from date,
  p_to date,
  p_bucket text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_bucket not in ('day', 'month') then
    raise exception 'bucket must be day or month, got %', p_bucket
      using errcode = '22023';
  end if;

  perform public.assert_range(p_from, p_to);

  -- A chart has a few hundred points in it at most. Past that the series is
  -- not something anyone is going to look at, and generate_series would be
  -- building rows nobody asked for.
  if p_bucket = 'day' and p_to - p_from > 400 then
    raise exception 'too many daily buckets: % days', p_to - p_from + 1
      using errcode = '22023';
  end if;
end;
$$;

-- The first day of every bucket in the range.
create or replace function public.bucket_starts(
  p_from date,
  p_to date,
  p_bucket text
)
returns setof date
language sql
immutable
set search_path = ''
as $$
  select generate_series(
    date_trunc(p_bucket, p_from::timestamp),
    date_trunc(p_bucket, p_to::timestamp),
    case p_bucket when 'day' then interval '1 day' else interval '1 month' end
  )::date;
$$;

-- The half-open instant range covering p_from .. p_to inclusive.
create or replace function public.local_day_range(
  p_from date,
  p_to date,
  out starts_at timestamptz,
  out ends_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text := public.user_timezone();
begin
  perform public.assert_range(p_from, p_to);

  starts_at := (p_from::timestamp at time zone v_tz);
  -- Exclusive upper bound at the start of the day after p_to: adding 24 hours
  -- to an instant instead would land an hour out on a daylight-saving day.
  ends_at := ((p_to + 1)::timestamp at time zone v_tz);
end;
$$;

-- ------------------------------------------------------ category totals ---

create or replace function public.category_totals(
  p_from date,
  p_to date,
  p_kind public.category_kind
)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
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
    sum(t.amount)::bigint as total
  from public.transactions t
  join public.categories c on c.id = t.category_id
  cross join bounds b
  where t.user_id = (select auth.uid())
    -- A transfer has no category and belongs to neither side of this split.
    and t.type = (p_kind::text)::public.transaction_type
    and t.occurred_at >= b.starts_at
    and t.occurred_at < b.ends_at
  group by c.id, c.name, c.icon, c.color
  order by sum(t.amount) desc, c.name;
$$;

comment on function public.category_totals(date, date, public.category_kind) is
  'Income or expense per category between two local dates, inclusive, biggest first.';

-- -------------------------------------------------------- period series ---

-- Income and expense per bucket, with the empty buckets filled in.
--
-- generate_series rather than only the days that have records: a bar chart
-- with the quiet days missing is a different shape from the real month, and
-- the eye reads the gap as activity.
create or replace function public.period_series(
  p_from date,
  p_to date,
  p_bucket text
)
returns table (
  bucket_start date,
  income bigint,
  expense bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text := public.user_timezone();
begin
  perform public.assert_bucket(p_from, p_to, p_bucket);

  return query
  with bounds as (
    select * from public.local_day_range(p_from, p_to)
  ),
  buckets as (
    select public.bucket_starts(p_from, p_to, p_bucket) as starts_on
  ),
  scoped as (
    select
      date_trunc(
        p_bucket,
        ((t.occurred_at at time zone v_tz)::date)::timestamp
      )::date as starts_on,
      t.type,
      t.amount
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.occurred_at >= b.starts_at
      and t.occurred_at < b.ends_at
  )
  select
    k.starts_on,
    coalesce(sum(s.amount) filter (where s.type = 'income'), 0)::bigint,
    coalesce(sum(s.amount) filter (where s.type = 'expense'), 0)::bigint
  from buckets k
  left join scoped s on s.starts_on = k.starts_on
  group by k.starts_on
  order by k.starts_on;
end;
$$;

comment on function public.period_series(date, date, text) is
  'Income and expense per day or per month across a range, empty buckets included.';

-- ------------------------------------------------------- balance series ---

-- The running balance at the end of each bucket.
--
-- Built from an opening balance plus a cumulative sum rather than re-summing
-- history per point: a year of daily points would otherwise be 365 scans of
-- the same rows.
--
-- p_account_id null means every account that counts towards the total. That
-- distinction matters for transfers: between two included accounts they net
-- to nothing, but into an excluded one they are money leaving.
create or replace function public.balance_series(
  p_from date,
  p_to date,
  p_bucket text,
  p_account_id uuid default null
)
returns table (
  bucket_start date,
  balance bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tz text := public.user_timezone();
  v_starts_at timestamptz;
begin
  perform public.assert_bucket(p_from, p_to, p_bucket);

  v_starts_at := (p_from::timestamp at time zone v_tz);

  return query
  with accounts as (
    select a.id, a.initial_balance
    from public.accounts a
    where a.user_id = v_user
      and (
        case when p_account_id is null
          then a.include_in_total
          else a.id = p_account_id
        end
      )
  ),
  -- Both legs of a transfer, as a signed delta against one account.
  movements as (
    select
      t.account_id,
      t.occurred_at,
      case when t.type = 'income' then t.amount else -t.amount end as delta
    from public.transactions t
    where t.user_id = v_user

    union all

    select
      t.to_account_id,
      t.occurred_at,
      t.amount
    from public.transactions t
    where t.user_id = v_user
      and t.type = 'transfer'
      and t.to_account_id is not null
  ),
  scoped as (
    select m.occurred_at, m.delta
    from movements m
    join accounts a on a.id = m.account_id
  ),
  opening as (
    select
      (select coalesce(sum(a.initial_balance), 0) from accounts a)
      + coalesce(
          (select sum(s.delta) from scoped s where s.occurred_at < v_starts_at),
          0
        ) as amount
  ),
  buckets as (
    select public.bucket_starts(p_from, p_to, p_bucket) as starts_on
  ),
  per_bucket as (
    select
      date_trunc(
        p_bucket,
        ((s.occurred_at at time zone v_tz)::date)::timestamp
      )::date as starts_on,
      sum(s.delta) as delta
    from scoped s, public.local_day_range(p_from, p_to) b
    where s.occurred_at >= b.starts_at
      and s.occurred_at < b.ends_at
    group by 1
  )
  select
    k.starts_on,
    ((select o.amount from opening o)
      + coalesce(
          sum(coalesce(p.delta, 0)) over (order by k.starts_on),
          0
        ))::bigint
  from buckets k
  left join per_bucket p on p.starts_on = k.starts_on
  order by k.starts_on;
end;
$$;

comment on function public.balance_series(date, date, text, uuid) is
  'Closing balance at the end of each bucket, for one account or every account counted in the total.';

grant execute on function
  public.assert_range(date, date),
  public.assert_bucket(date, date, text),
  public.bucket_starts(date, date, text),
  public.local_day_range(date, date),
  public.category_totals(date, date, public.category_kind),
  public.period_series(date, date, text),
  public.balance_series(date, date, text, uuid)
to authenticated;

revoke execute on function
  public.assert_range(date, date),
  public.assert_bucket(date, date, text),
  public.bucket_starts(date, date, text),
  public.local_day_range(date, date),
  public.category_totals(date, date, public.category_kind),
  public.period_series(date, date, text),
  public.balance_series(date, date, text, uuid)
from anon;
