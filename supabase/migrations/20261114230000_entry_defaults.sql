-- Paisa: what the Add Record sheet should already know.
--
-- Most records are not a surprise. People buy coffee in the morning from the
-- same wallet and groceries in the evening on the same card, so the sheet can
-- open with the right account chosen and the likely categories at the top —
-- which is the difference between four taps and seven.
--
-- Worked out from the records themselves rather than remembered on the
-- device: a preference stored in localStorage is wrong the moment someone
-- picks up their other phone.
create or replace function public.entry_defaults()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with settings as (
    select
      (select auth.uid()) as uid,
      public.user_timezone() as tz
  ),
  -- The part of the day we are in now. Four buckets, because the difference
  -- that matters is breakfast from dinner, not 9am from 10am.
  bucket as (
    select
      s.uid,
      s.tz,
      case
        when extract(hour from (now() at time zone s.tz)) between 5 and 10
          then 'morning'
        when extract(hour from (now() at time zone s.tz)) between 11 and 16
          then 'afternoon'
        when extract(hour from (now() at time zone s.tz)) between 17 and 21
          then 'evening'
        else 'night'
      end as part
    from settings s
  ),
  recent as (
    select
      t.category_id,
      t.account_id,
      t.occurred_at,
      case
        when extract(hour from (t.occurred_at at time zone b.tz)) between 5 and 10
          then 'morning'
        when extract(hour from (t.occurred_at at time zone b.tz)) between 11 and 16
          then 'afternoon'
        when extract(hour from (t.occurred_at at time zone b.tz)) between 17 and 21
          then 'evening'
        else 'night'
      end as part
    from public.transactions t, bucket b
    where t.user_id = b.uid
      and t.type = 'expense'
      -- Three months: long enough to have a habit in it, short enough that a
      -- habit someone has dropped falls out of it.
      and t.occurred_at >= now() - interval '90 days'
  ),
  suggested as (
    select r.category_id
    from recent r
    join public.categories c
      on c.id = r.category_id
     and c.archived = false
    cross join bucket b
    where r.part = b.part
      and r.category_id is not null
    group by r.category_id
    order by count(*) desc, max(r.occurred_at) desc
    limit 4
  ),
  last_used as (
    select t.account_id
    from public.transactions t, bucket b
    where t.user_id = b.uid
    order by t.occurred_at desc, t.id desc
    limit 1
  )
  select jsonb_build_object(
    'lastAccountId', (
      select a.id from public.accounts a
      where a.id = (select account_id from last_used)
        and a.archived = false
    ),
    'suggestedCategoryIds',
      coalesce((select jsonb_agg(s.category_id) from suggested s), '[]'::jsonb),
    'partOfDay', (select part from bucket)
  );
$$;

comment on function public.entry_defaults() is
  'The account last used and the categories usually picked at this time of day, for the Add Record sheet.';

revoke execute on function public.entry_defaults() from public, anon;
grant execute on function public.entry_defaults() to authenticated;
