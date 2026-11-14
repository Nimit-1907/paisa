-- Paisa: the reads behind the charts.
--
--     supabase test db
--
-- The charts and the record list are two views of one set of rows, and the
-- only interesting question is whether they ever disagree. So these tests
-- mostly check the RPCs against something already trusted: month_summary for
-- the totals, account_balances for the closing balance.
--
-- The rest is about shape — empty buckets present, both ends of the range
-- included, transfers counted once or not at all.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'analysis@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}';

-- Two accounts that count towards the total, one that does not.
insert into public.accounts (id, user_id, name, type, initial_balance, include_in_total)
values
  ('f0000000-0000-4000-8000-000000000010',
   'ffffffff-0000-4000-8000-000000000001', 'Bank', 'bank', 1000000, true),
  ('f0000000-0000-4000-8000-000000000011',
   'ffffffff-0000-4000-8000-000000000001', 'Wallet', 'wallet', 0, true),
  ('f0000000-0000-4000-8000-000000000012',
   'ffffffff-0000-4000-8000-000000000001', 'Savings pot', 'savings', 500000, false);

-- A fixed three-day window inside one month, so nothing depends on today.
create temporary table win as
select date '2026-03-10' as d1, date '2026-03-11' as d2, date '2026-03-12' as d3;

-- Midday local, the way the recurring generator writes its rows.
create or replace function pg_temp.at_noon(p_day date)
returns timestamptz
language sql
stable
as $$ select (p_day + time '12:00')::timestamp at time zone 'Asia/Kolkata'; $$;

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'expense', 150000,
       'f0000000-0000-4000-8000-000000000010', c.id, 'Day one food',
       pg_temp.at_noon(w.d1)
from public.categories c, win w
where c.user_id = 'ffffffff-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'expense', 50000,
       'f0000000-0000-4000-8000-000000000010', c.id, 'Day three food',
       pg_temp.at_noon(w.d3)
from public.categories c, win w
where c.user_id = 'ffffffff-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'expense', 90000,
       'f0000000-0000-4000-8000-000000000010', c.id, 'Day three transport',
       pg_temp.at_noon(w.d3)
from public.categories c, win w
where c.user_id = 'ffffffff-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Transport';

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'income', 700000,
       'f0000000-0000-4000-8000-000000000010', c.id, 'Salary',
       pg_temp.at_noon(w.d1)
from public.categories c, win w
where c.user_id = 'ffffffff-0000-4000-8000-000000000001'
  and c.kind = 'income' and c.name = 'Salary';

-- A transfer between two included accounts: it must not read as spending,
-- and must not move the overall balance either.
insert into public.transactions (
  user_id, type, amount, account_id, to_account_id, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'transfer', 200000,
       'f0000000-0000-4000-8000-000000000010',
       'f0000000-0000-4000-8000-000000000011',
       pg_temp.at_noon(w.d2)
from win w;

-- Outside the window, to prove the bounds hold.
insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'ffffffff-0000-4000-8000-000000000001', 'expense', 999000,
       'f0000000-0000-4000-8000-000000000010', c.id, 'Before the window',
       pg_temp.at_noon(w.d1 - 1)
from public.categories c, win w
where c.user_id = 'ffffffff-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

-- --------------------------------------------------- category_totals ------

select is(
  (select array_agg(name order by total desc)
     from public.category_totals(
       (select d1 from win), (select d3 from win), 'expense')),
  array['Food', 'Transport'],
  'expense categories come back biggest first'
);

select is(
  (select total from public.category_totals(
     (select d1 from win), (select d3 from win), 'expense') where name = 'Food'),
  200000::bigint,
  'both ends of the range are included'
);

select is(
  (select count(*)::int from public.category_totals(
     (select d1 from win), (select d3 from win), 'expense')),
  2,
  'a transfer has no category and appears in neither kind'
);

select is(
  (select sum(total)::bigint from public.category_totals(
     (select d1 from win), (select d3 from win), 'income')),
  700000::bigint,
  'income is a separate question with its own answer'
);

select is(
  (select coalesce(sum(total), 0)::bigint from public.category_totals(
     (select d1 - 5 from win), (select d1 - 2 from win), 'expense')),
  0::bigint,
  'a range with nothing in it comes back empty rather than null'
);

-- The number the record list would show for the same month.
select is(
  (select sum(total)::bigint from public.category_totals(
     date '2026-03-01', date '2026-03-31', 'expense')),
  (select total_expense from public.month_summary(date '2026-03-01')),
  'category totals add up to what month_summary reports'
);

-- ----------------------------------------------------- period_series ------

select is(
  (select count(*)::int from public.period_series(
     (select d1 from win), (select d3 from win), 'day')),
  3,
  'a three-day range is three buckets'
);

select is(
  (select array_agg(expense order by bucket_start)
     from public.period_series(
       (select d1 from win), (select d3 from win), 'day')),
  array[150000::bigint, 0::bigint, 140000::bigint],
  'the quiet day is a zero rather than a missing bar'
);

select is(
  (select array_agg(income order by bucket_start)
     from public.period_series(
       (select d1 from win), (select d3 from win), 'day')),
  array[700000::bigint, 0::bigint, 0::bigint],
  'income and expense are counted separately per day'
);

select is(
  (select sum(income) || '/' || sum(expense)
     from public.period_series(date '2026-03-01', date '2026-03-31', 'day')),
  (select total_income || '/' || total_expense
     from public.month_summary(date '2026-03-01')),
  'a month of daily buckets adds up to what month_summary reports'
);

select is(
  (select count(*)::int from public.period_series(
     date '2026-01-01', date '2026-12-31', 'month')),
  12,
  'a year of monthly buckets is twelve of them'
);

select throws_ok(
  $$ select * from public.period_series(date '2026-03-01', date '2026-03-31', 'week') $$,
  '22023',
  null,
  'an unknown bucket is refused rather than guessed at'
);

-- These are callable straight through PostgREST, so they have to defend
-- themselves rather than trust the screen's own clamp.
select throws_ok(
  $$ select * from public.period_series(date '2026-03-31', date '2026-03-01', 'day') $$,
  '22023',
  null,
  'a range that ends before it starts is refused'
);

select throws_ok(
  $$ select * from public.period_series(date '2020-01-01', date '2026-12-31', 'day') $$,
  '22023',
  null,
  'a range too long to draw as daily bars is refused'
);

select throws_ok(
  $$ select * from public.category_totals(date '1900-01-01', date '2026-12-31', 'expense') $$,
  '22023',
  null,
  '…and a range of centuries is refused wherever it is passed'
);

-- ---------------------------------------------------- balance_series ------

select is(
  (select balance from public.balance_series(
     (select d1 from win), (select d3 from win), 'day')
   order by bucket_start limit 1),
  (1000000 - 999000 + 700000 - 150000)::bigint,
  'the first point opens with everything that happened before the range'
);

select is(
  (select balance from public.balance_series(
     (select d1 from win), (select d2 from win), 'day')
   order by bucket_start desc limit 1),
  (1000000 - 999000 + 700000 - 150000)::bigint,
  'a transfer between two counted accounts does not move the total'
);

select is(
  (select balance from public.balance_series(
     date '2026-03-01', date '2026-03-31', 'day')
   order by bucket_start desc limit 1),
  (select sum(balance)::bigint from public.account_balances
    where include_in_total),
  'the last point is the balance the accounts screen shows'
);

-- One account on its own does see its own transfers.
select is(
  (select balance from public.balance_series(
     date '2026-03-01', date '2026-03-31', 'day',
     'f0000000-0000-4000-8000-000000000011')
   order by bucket_start desc limit 1),
  200000::bigint,
  'a single account counts the transfer that arrived in it'
);

reset role;

select * from finish();

rollback;
