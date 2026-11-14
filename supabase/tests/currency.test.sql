-- Paisa: changing currency.
--
--     supabase test db
--
-- Amounts are whole minor units, so what a stored 1250 means depends on the
-- profile's decimal_places: ₹12.50 at two, ¥1,250 at zero. Changing one
-- without the other multiplies somebody's entire history by a hundred, and
-- the only way to know it happened is to notice that every number looks
-- wrong.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'c0ffee00-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'currency@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"c0ffee00-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.accounts (id, user_id, name, type, initial_balance)
values ('c0ffee00-0000-4000-8000-000000000010',
        'c0ffee00-0000-4000-8000-000000000001', 'Bank', 'bank', 500000);

-- ₹1,250.00 and ₹12.50: one that divides cleanly and one that does not.
insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'c0ffee00-0000-4000-8000-000000000001', 'expense', amount,
       'c0ffee00-0000-4000-8000-000000000010', c.id, note, now()
from public.categories c,
     (values (125000::bigint, 'Round'), (1250::bigint, 'Awkward')) as v(amount, note)
where c.user_id = 'c0ffee00-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.budgets (user_id, category_id, month, amount)
select 'c0ffee00-0000-4000-8000-000000000001', c.id,
       date_trunc('month', current_date)::date, 700000
from public.categories c
where c.user_id = 'c0ffee00-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.recurring_rules (
  user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'c0ffee00-0000-4000-8000-000000000001', 'expense', 2200000,
       'c0ffee00-0000-4000-8000-000000000010', c.id, 'Rent',
       'monthly', 1, current_date, current_date + 30
from public.categories c
where c.user_id = 'c0ffee00-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Rent';

-- ------------------------------------------- same exponent, nothing moves --

select is(
  public.change_currency('USD', '$', 2::smallint),
  0,
  'swapping ₹ for $ rescales nothing: both keep two decimal places'
);

select is(
  (select amount from public.transactions
    where user_id = 'c0ffee00-0000-4000-8000-000000000001' and note = 'Round'),
  125000::bigint,
  '…so the amounts are untouched'
);

select is(
  (select currency_symbol from public.profiles
    where id = 'c0ffee00-0000-4000-8000-000000000001'),
  '$',
  '…and the symbol did change'
);

-- ------------------------------------------- fewer decimals, all of it ----

select is(
  public.change_currency('JPY', '¥', 0::smallint),
  2,
  'moving to a currency with no decimals rescales every transaction'
);

select is(
  (select amount from public.transactions
    where user_id = 'c0ffee00-0000-4000-8000-000000000001' and note = 'Round'),
  1250::bigint,
  '$1,250.00 becomes ¥1,250 — the number a user reads stays put'
);

select is(
  (select amount from public.transactions
    where user_id = 'c0ffee00-0000-4000-8000-000000000001' and note = 'Awkward'),
  13::bigint,
  '…and $12.50 rounds to ¥13 rather than truncating to ¥12'
);

select is(
  (select initial_balance from public.accounts
    where id = 'c0ffee00-0000-4000-8000-000000000010'),
  5000::bigint,
  'the opening balance comes along'
);

select is(
  (select amount from public.budgets
    where user_id = 'c0ffee00-0000-4000-8000-000000000001'),
  7000::bigint,
  '…and so do budgets'
);

select is(
  (select amount from public.recurring_rules
    where user_id = 'c0ffee00-0000-4000-8000-000000000001'),
  22000::bigint,
  '…and recurring rules, which would otherwise charge a hundred times over'
);

-- Nothing may become zero: the amount CHECK refuses it, and an amount of
-- nothing is not a record anyone meant to keep.
select ok(
  (select min(amount) from public.transactions
    where user_id = 'c0ffee00-0000-4000-8000-000000000001') >= 1,
  'a tiny amount is floored at one unit rather than rounded out of existence'
);

reset role;

select * from finish();

rollback;
