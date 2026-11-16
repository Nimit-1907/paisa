-- Paisa: the recurring generator.
--
--     supabase test db
--
-- Two halves. First the arithmetic, which is pure: a monthly rule on the 31st
-- across February, a fortnightly rule, and 29 February carried through three
-- common years. Then the generator itself: catching up months that were
-- missed while the app was closed, skipping what the user skipped, stopping at
-- the end date, and, the one that matters most, running twice without
-- creating a second copy of anything.
--
-- src/lib/recurrence.test.ts asserts the same dates in TypeScript; the two
-- have to agree, because the client draws the upcoming list from one and the
-- rows come from the other.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'recurring@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now(), '', '', '', ''
);

insert into public.accounts (id, user_id, name, type)
values ('d0000000-0000-4000-8000-000000000010',
        'dddddddd-0000-4000-8000-000000000001', 'Bank', 'bank');

-- ------------------------------------------------- the arithmetic, alone ---

-- Monthly on the 31st, across a February. A stepped cursor would clamp to the
-- 28th and stay there; the anchor brings it back to the 31st.
select is(
  (select array_agg(
            public.recurrence_occurrence(
              date '2026-01-31', 'monthly', 1, n, 31::smallint
            ) order by n)
     from generate_series(0, 4) as n),
  array[date '2026-01-31', date '2026-02-28', date '2026-03-31',
        date '2026-04-30', date '2026-05-31'],
  'monthly on the 31st clamps through February and comes back'
);

select is(
  public.recurrence_occurrence(date '2026-01-31', 'monthly', 1, 1, 31::smallint),
  date '2026-02-28',
  'February gets the 28th'
);

-- Every two weeks: always the same weekday, 14 days apart.
select is(
  (select array_agg(
            public.recurrence_occurrence(
              date '2026-11-02', 'weekly', 2, n, null
            ) order by n)
     from generate_series(0, 3) as n),
  array[date '2026-11-02', date '2026-11-16', date '2026-11-30',
        date '2026-12-14'],
  'a fortnightly rule steps 14 days at a time'
);

select is(
  (select count(distinct extract(dow from
            public.recurrence_occurrence(date '2026-11-02', 'weekly', 2, n, null)))
     from generate_series(0, 8) as n)::int,
  1,
  '…and never changes weekday'
);

-- 29 February: three common years on the 28th, then back to the 29th.
select is(
  (select array_agg(
            public.recurrence_occurrence(
              date '2024-02-29', 'yearly', 1, n, 29::smallint
            ) order by n)
     from generate_series(0, 4) as n),
  array[date '2024-02-29', date '2025-02-28', date '2026-02-28',
        date '2027-02-28', date '2028-02-29'],
  'a yearly rule on 29 February waits out the common years'
);

-- A daily rule is just days; the anchor has nothing to say about it.
select is(
  public.recurrence_occurrence(date '2026-01-30', 'daily', 3, 2, 31::smallint),
  date '2026-02-05',
  'a daily rule ignores the anchor day'
);

-- recurrence_after snaps a cursor onto the schedule in both directions.
select is(
  public.recurrence_after(date '2026-01-31', 'monthly', 1, 31::smallint,
                          date '2026-03-01'),
  date '2026-03-31',
  'recurrence_after finds the next occurrence from mid-month'
);

select is(
  public.recurrence_after(date '2026-01-31', 'monthly', 1, 31::smallint,
                          date '2026-01-01'),
  date '2026-01-31',
  '…and does not walk past the first one'
);

select is(
  public.recurrence_after(date '2026-02-28', 'monthly', 1, 28::smallint,
                          date '2026-02-28'),
  date '2026-02-28',
  '…and an occurrence is its own answer'
);

-- -------------------------------------------- the generator, as the user ---

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}';

-- Three months missed while the app was closed. next_run_on still points at
-- the first of them, which is what a real catch-up looks like.
insert into public.recurring_rules (
  id, user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'd0000000-0000-4000-8000-000000000100',
       'dddddddd-0000-4000-8000-000000000001', 'expense', 2200000,
       'd0000000-0000-4000-8000-000000000010', f.id, 'Catch-up rent',
       'monthly', 1,
       (date_trunc('month', current_date) - interval '3 months')::date,
       (date_trunc('month', current_date) - interval '3 months')::date
from public.categories f
where f.user_id = 'dddddddd-0000-4000-8000-000000000001'
  and f.kind = 'expense' and f.name = 'Rent';

select is(
  (select anchor_day from public.recurring_rules
    where id = 'd0000000-0000-4000-8000-000000000100'),
  1::smallint,
  'a new rule takes its anchor day from its start date'
);

select is(
  public.process_due_recurring(),
  4,
  'three missed months and this one are created in a single catch-up'
);

select is(
  (select count(*)::int from public.transactions
    where recurring_rule_id = 'd0000000-0000-4000-8000-000000000100'),
  4,
  '…and that is four transactions'
);

select is(
  (select next_run_on from public.recurring_rules
    where id = 'd0000000-0000-4000-8000-000000000100'),
  (date_trunc('month', current_date) + interval '1 month')::date,
  '…with the cursor parked on next month'
);

select is(
  (select last_run_on from public.recurring_rules
    where id = 'd0000000-0000-4000-8000-000000000100'),
  date_trunc('month', current_date)::date,
  '…and last_run_on on the occurrence it just created'
);

-- The whole point of the unique index.
select is(
  public.process_due_recurring(),
  0,
  'running it again creates nothing'
);

select is(
  (select count(*)::int from public.transactions
    where recurring_rule_id = 'd0000000-0000-4000-8000-000000000100'),
  4,
  '…and leaves the transactions exactly as they were'
);

-- Even with the cursor wound back by hand, a crash between the insert and
-- the update, two tabs racing, the index refuses the second copy.
update public.recurring_rules
set next_run_on = (date_trunc('month', current_date) - interval '3 months')::date
where id = 'd0000000-0000-4000-8000-000000000100';

select is(
  public.process_due_recurring(),
  0,
  'a rewound cursor still cannot duplicate a month'
);

select is(
  (select count(*)::int from public.transactions
    where recurring_rule_id = 'd0000000-0000-4000-8000-000000000100'),
  4,
  '…not even one extra row'
);

-- A skipped occurrence is passed over and never comes back.
insert into public.recurring_rules (
  id, user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on, skipped_dates
)
select 'd0000000-0000-4000-8000-000000000101',
       'dddddddd-0000-4000-8000-000000000001', 'expense', 50000,
       'd0000000-0000-4000-8000-000000000010', f.id, 'Skipped weekly',
       'weekly', 1,
       current_date - 21, current_date - 21,
       array[current_date - 14]
from public.categories f
where f.user_id = 'dddddddd-0000-4000-8000-000000000001'
  and f.kind = 'expense' and f.name = 'Rent';

select is(
  (select count(*)::int from public.transactions t
     where t.recurring_rule_id = 'd0000000-0000-4000-8000-000000000101'),
  0,
  'the skipped-weekly rule starts with nothing'
);

select is(
  public.process_due_recurring(),
  3,
  'four weekly occurrences minus the skipped one'
);

select is(
  (select array_agg((occurred_at at time zone 'Asia/Kolkata')::date order by occurred_at)
     from public.transactions
    where recurring_rule_id = 'd0000000-0000-4000-8000-000000000101'),
  array[current_date - 21, current_date - 7, current_date],
  '…and the skipped date is the one missing'
);

-- Pay now: the occurrence keeps its own date, and the rule moves past it.
-- Its own statement: a row inserted by a function is not visible to the
-- snapshot of the statement that called it, so joining to it in the same
-- query finds nothing.
create temporary table paid_occurrence as
select public.materialise_recurring(
  'd0000000-0000-4000-8000-000000000101', current_date + 7
) as id;

select is(
  (select (t.occurred_at at time zone 'Asia/Kolkata')::date
     from paid_occurrence p
     join public.transactions t on t.id = p.id),
  current_date + 7,
  'paying an occurrence early books it on its scheduled day'
);

select is(
  (select next_run_on from public.recurring_rules
    where id = 'd0000000-0000-4000-8000-000000000101'),
  current_date + 14,
  '…and the rule is now due the week after'
);

-- Paying or skipping something further out must not step over an occurrence
-- that is still owed: it would vanish without ever being created or skipped.
insert into public.recurring_rules (
  id, user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'd0000000-0000-4000-8000-000000000102',
       'dddddddd-0000-4000-8000-000000000001', 'expense', 10000,
       'd0000000-0000-4000-8000-000000000010', f.id, 'Cursor guard',
       'weekly', 1, current_date - 14, current_date - 14
from public.categories f
where f.user_id = 'dddddddd-0000-4000-8000-000000000001'
  and f.kind = 'expense' and f.name = 'Rent';

create temporary table paid_ahead as
select public.materialise_recurring(
  'd0000000-0000-4000-8000-000000000102', current_date + 7
) as id;

select isnt(
  (select id from paid_ahead),
  null,
  'an occurrence a week out can be paid early'
);

select is(
  (select next_run_on from public.recurring_rules
    where id = 'd0000000-0000-4000-8000-000000000102'),
  current_date - 14,
  '…without moving a cursor that still owes three occurrences'
);

select is(
  public.process_due_recurring(),
  3,
  'the owed occurrences are still created afterwards'
);

select is(
  (select array_agg((occurred_at at time zone 'Asia/Kolkata')::date order by occurred_at)
     from public.transactions
    where recurring_rule_id = 'd0000000-0000-4000-8000-000000000102'),
  array[current_date - 14, current_date - 7, current_date, current_date + 7],
  '…and the one paid early is still the only copy of itself'
);

-- Skipping works the same way round.
select is(
  public.skip_recurring_occurrence(
    'd0000000-0000-4000-8000-000000000102', current_date + 14
  ),
  current_date + 7,
  'skipping a later date leaves the cursor where it was'
);

reset role;

select * from finish();

rollback;
