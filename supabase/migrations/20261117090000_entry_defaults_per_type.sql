-- Paisa: Add Record's account guess, one per kind of record.
--
-- entry_defaults() used to return the account of the newest record of any
-- type. That is the wrong guess as often as not: after a card expense,
-- salary opened on the card. It now returns the account each type last
-- used, and for a transfer both ends, skipping archived accounts.
-- `lastAccountId` is gone; the app reads `lastAccounts`.
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
  -- One transfer, both ends from the same row, and both still open. Two
  -- separate lookups could take From from one transfer and To from
  -- another, and start a transfer from an account into itself.
  last_transfer as (
    select t.account_id, t.to_account_id
    from public.transactions t
    join public.accounts a
      on a.id = t.account_id
     and a.archived = false
    join public.accounts b
      on b.id = t.to_account_id
     and b.archived = false
    where t.user_id = (select uid from settings)
      and t.type = 'transfer'
    order by t.occurred_at desc, t.id desc
    limit 1
  )
  select jsonb_build_object(
    'lastAccounts', jsonb_build_object(
      'expense', (
      select t.account_id
      from public.transactions t
      join public.accounts a
        on a.id = t.account_id
       and a.archived = false
      where t.user_id = (select uid from settings)
        and t.type = 'expense'
      order by t.occurred_at desc, t.id desc
      limit 1
    ),
      'income', (
      select t.account_id
      from public.transactions t
      join public.accounts a
        on a.id = t.account_id
       and a.archived = false
      where t.user_id = (select uid from settings)
        and t.type = 'income'
      order by t.occurred_at desc, t.id desc
      limit 1
    ),
      'transfer', (select lt.account_id from last_transfer lt),
      'transferTo', (select lt.to_account_id from last_transfer lt)
    ),
    'suggestedCategoryIds',
      coalesce((select jsonb_agg(s.category_id) from suggested s), '[]'::jsonb),
    'partOfDay', (select part from bucket)
  );
$$;

comment on function public.entry_defaults() is
  'The account last used for each type of record (and a transfer''s other end), and the categories usually picked at this time of day, for the Add Record sheet.';

revoke execute on function public.entry_defaults() from public, anon;
grant execute on function public.entry_defaults() to authenticated;
