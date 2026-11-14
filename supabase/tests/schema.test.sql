-- Paisa: schema and business-rule test.
--
--     supabase test db
--
-- The constraints that stop a record from being nonsense: a transfer with no
-- destination, an expense filed under an income category, a budget on the 14th
-- of the month, a duplicate category name, a negative amount.
--
-- Runs as the table owner (no RLS in the way) inside a rolled-back
-- transaction; rls.test.sql covers the per-user isolation.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'schema@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Schema User"}'::jsonb, now(), now(), '', '', '', ''
);

-- ------------------------------------------------- what a signup receives --

select is(
  (select count(*) from public.profiles
    where id = 'cccccccc-0000-4000-8000-000000000001')::int,
  1,
  'signing up creates a profile'
);

select is(
  (select currency_symbol from public.profiles
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  '₹',
  'the profile starts on the rupee'
);

select is(
  (select count(*) from public.accounts
    where user_id = 'cccccccc-0000-4000-8000-000000000001')::int,
  1,
  'signing up creates exactly one account'
);

select is(
  (select name from public.accounts
    where user_id = 'cccccccc-0000-4000-8000-000000000001'),
  'Cash',
  '…and it is Cash'
);

select is(
  (select count(*) from public.categories
    where user_id = 'cccccccc-0000-4000-8000-000000000001')::int,
  (select count(*) from public.default_categories())::int,
  'signing up seeds the full default category set'
);

insert into public.accounts (id, user_id, name, type)
values
  ('c0000000-0000-4000-8000-000000000010',
   'cccccccc-0000-4000-8000-000000000001', 'Bank', 'bank'),
  ('c0000000-0000-4000-8000-000000000011',
   'cccccccc-0000-4000-8000-000000000001', 'Wallet', 'wallet');

-- ------------------------------------------------------- category rules ----

select throws_ok(
  $$
    insert into public.categories (user_id, name, kind)
    values ('cccccccc-0000-4000-8000-000000000001', '  food  ', 'expense')
  $$,
  '23505',
  null,
  'a category name is unique per kind, ignoring case and padding'
);

select lives_ok(
  $$
    insert into public.categories (user_id, name, kind)
    values ('cccccccc-0000-4000-8000-000000000001', 'Food', 'income')
  $$,
  'the same name may exist once per kind'
);

-- ---------------------------------------------------- transaction shapes ---

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, category_id, occurred_at
    )
    select 'cccccccc-0000-4000-8000-000000000001', 'expense', 0,
           'c0000000-0000-4000-8000-000000000010', c.id, now()
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Food'
  $$,
  '23514',
  null,
  'an amount of zero is rejected'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, occurred_at
    )
    values ('cccccccc-0000-4000-8000-000000000001', 'expense', 1000,
            'c0000000-0000-4000-8000-000000000010', now())
  $$,
  '23514',
  null,
  'an expense without a category is rejected'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, occurred_at
    )
    values ('cccccccc-0000-4000-8000-000000000001', 'transfer', 1000,
            'c0000000-0000-4000-8000-000000000010', now())
  $$,
  '23514',
  null,
  'a transfer without a destination is rejected'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, to_account_id, occurred_at
    )
    values ('cccccccc-0000-4000-8000-000000000001', 'transfer', 1000,
            'c0000000-0000-4000-8000-000000000010',
            'c0000000-0000-4000-8000-000000000010', now())
  $$,
  '23514',
  null,
  'a transfer to the same account is rejected'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, to_account_id, category_id, occurred_at
    )
    select 'cccccccc-0000-4000-8000-000000000001', 'transfer', 1000,
           'c0000000-0000-4000-8000-000000000010',
           'c0000000-0000-4000-8000-000000000011', c.id, now()
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Food'
  $$,
  '23514',
  null,
  'a transfer carrying a category is rejected'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, category_id, occurred_at
    )
    select 'cccccccc-0000-4000-8000-000000000001', 'expense', 1000,
           'c0000000-0000-4000-8000-000000000010', c.id, now()
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'income' and c.name = 'Salary'
  $$,
  '23514',
  null,
  'an expense filed under an income category is rejected'
);

-- ------------------------------------------------------------ budgets ------

select throws_ok(
  $$
    insert into public.budgets (user_id, category_id, month, amount)
    select 'cccccccc-0000-4000-8000-000000000001', c.id,
           date_trunc('month', current_date)::date + 13, 500000
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Food'
  $$,
  '23514',
  null,
  'a budget month must be the first of the month'
);

select throws_ok(
  $$
    insert into public.budgets (user_id, category_id, month, amount)
    select 'cccccccc-0000-4000-8000-000000000001', c.id,
           date_trunc('month', current_date)::date, 500000
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'income' and c.name = 'Salary'
  $$,
  '23514',
  null,
  'a budget on an income category is rejected'
);

insert into public.budgets (user_id, category_id, month, amount)
select 'cccccccc-0000-4000-8000-000000000001', c.id,
       date_trunc('month', current_date)::date, 500000
from public.categories c
where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

select throws_ok(
  $$
    insert into public.budgets (user_id, category_id, month, amount)
    select 'cccccccc-0000-4000-8000-000000000001', c.id,
           date_trunc('month', current_date)::date, 900000
    from public.categories c
    where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Food'
  $$,
  '23505',
  null,
  'one budget per category per month'
);

-- -------------------------------------------------------- balances math ----

insert into public.transactions (
  user_id, type, amount, account_id, to_account_id, category_id, occurred_at
)
select 'cccccccc-0000-4000-8000-000000000001', 'income', 100000,
       'c0000000-0000-4000-8000-000000000010', null, c.id, now()
from public.categories c
where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
  and c.kind = 'income' and c.name = 'Salary';

insert into public.transactions (
  user_id, type, amount, account_id, to_account_id, category_id, occurred_at
)
select 'cccccccc-0000-4000-8000-000000000001', 'expense', 25000,
       'c0000000-0000-4000-8000-000000000010', null, c.id, now()
from public.categories c
where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.transactions (
  user_id, type, amount, account_id, to_account_id, occurred_at
)
values ('cccccccc-0000-4000-8000-000000000001', 'transfer', 30000,
        'c0000000-0000-4000-8000-000000000010',
        'c0000000-0000-4000-8000-000000000011', now());

select is(
  (select balance from public.account_balances
    where account_id = 'c0000000-0000-4000-8000-000000000010'),
  45000::bigint,
  'balance = initial + income - expense - transfer out'
);

select is(
  (select balance from public.account_balances
    where account_id = 'c0000000-0000-4000-8000-000000000011'),
  30000::bigint,
  'the destination account receives the transfer'
);

-- ----------------------------------------------------------- updated_at ----

update public.accounts
set name = 'Bank renamed'
where id = 'c0000000-0000-4000-8000-000000000010';

select ok(
  (select updated_at > created_at from public.accounts
    where id = 'c0000000-0000-4000-8000-000000000010'),
  'updating a row moves updated_at'
);

-- ------------------------------------------- recurring rules: the end date --

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.recurring_rules (
  user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, end_date, next_run_on
)
select 'cccccccc-0000-4000-8000-000000000001', 'expense', 50000,
       'c0000000-0000-4000-8000-000000000010', c.id, 'Weekly tiffin',
       'weekly', 1,
       current_date - 21, current_date - 7, current_date - 21
from public.categories c
where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

select is(
  (select created_count from public.process_due_recurring()
    where created_count is not null limit 1),
  3,
  'a weekly rule that ended last week creates exactly its three occurrences'
);

select is(
  (select active from public.recurring_rules where note = 'Weekly tiffin'),
  false,
  'a rule past its end date switches itself off'
);

-- Month-end anchoring: stepping a cursor forward would clamp to the 28th in
-- February and stay there for good.
insert into public.recurring_rules (
  user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, end_date, next_run_on
)
select 'cccccccc-0000-4000-8000-000000000001', 'expense', 2200000,
       'c0000000-0000-4000-8000-000000000010', c.id, 'Month-end rent',
       'monthly', 1,
       date '2026-01-31', date '2026-04-15', date '2026-01-31'
from public.categories c
where c.user_id = 'cccccccc-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Rent';

select is(
  (select created_count from public.process_due_recurring()
    where rule_id = (select id from public.recurring_rules
                      where note = 'Month-end rent')),
  3,
  'a month-end rule runs until its end date and no further'
);

select is(
  (select array_agg((occurred_at at time zone 'Asia/Kolkata')::date
                    order by occurred_at)
     from public.transactions where note = 'Month-end rent'),
  array[date '2026-01-31', date '2026-02-28', date '2026-03-31'],
  'a monthly rule anchored on the 31st does not drift to the 28th'
);

reset role;

select * from finish();

rollback;
