-- Paisa: row level security test.
--
--     supabase test db
--
-- Two users, fixed ids, every table probed from inside a real `authenticated`
-- session: user A must see exactly their own rows and must fail, not silently
-- no-op, when they reach for user B's.
--
-- Everything runs in a transaction that is rolled back, so it is safe against
-- a seeded database.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- ------------------------------------------------------------- fixtures ----
-- Fixed ids so the assertions below can be plain SQL literals: once the
-- session is a normal user, RLS hides the other user's rows from any lookup.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'rls-a@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"User A"}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'rls-b@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"User B"}'::jsonb, now(), now(), '', '', '', ''
  );

insert into public.accounts (id, user_id, name, type, initial_balance)
values
  ('a0000000-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'A Bank', 'bank', 100000),
  ('b0000000-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000001', 'B Bank', 'bank', 900000);

insert into public.categories (id, user_id, name, kind)
values
  ('a0000000-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000001', 'A Expense', 'expense'),
  ('b0000000-0000-4000-8000-000000000003',
   'bbbbbbbb-0000-4000-8000-000000000001', 'B Expense', 'expense');

insert into public.transactions (
  id, user_id, type, amount, account_id, category_id, note, occurred_at
)
values
  ('a0000000-0000-4000-8000-000000000004',
   'aaaaaaaa-0000-4000-8000-000000000001', 'expense', 25000,
   'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003', 'A lunch', now()),
  ('b0000000-0000-4000-8000-000000000004',
   'bbbbbbbb-0000-4000-8000-000000000001', 'expense', 75000,
   'b0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000003', 'B lunch', now());

insert into public.budgets (user_id, category_id, month, amount)
values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003',
   date_trunc('month', now())::date, 500000),
  ('bbbbbbbb-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003',
   date_trunc('month', now())::date, 800000);

-- ------------------------------------------------- user A's point of view --

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select auth.uid()),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'the session really is user A'
);

select is(
  (select count(*) from public.transactions where user_id <> auth.uid())::int,
  0,
  'A sees no transaction belonging to anyone else'
);

select is(
  (select count(*) from public.transactions)::int,
  1,
  'A sees exactly their own transaction'
);

select is(
  (select count(*) from public.profiles)::int,
  1,
  'A sees one profile: their own'
);

select is(
  (select count(*) from public.accounts
    where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid)::int,
  0,
  'A cannot read B''s accounts'
);

select is(
  (select count(*) from public.categories
    where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid)::int,
  0,
  'A cannot read B''s categories'
);

select is(
  (select count(*) from public.budgets
    where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid)::int,
  0,
  'A cannot read B''s budgets'
);

select is(
  (select count(*) from public.account_balances
    where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid)::int,
  0,
  'the account_balances view does not leak B''s balances'
);

-- A write aimed at B's rows must change nothing.
with updated as (
  update public.transactions
  set note = 'hijacked'
  where id = 'b0000000-0000-4000-8000-000000000004'
  returning 1
)
select is((select count(*) from updated)::int, 0, 'A cannot update B''s transaction');

with deleted as (
  delete from public.transactions
  where id = 'b0000000-0000-4000-8000-000000000004'
  returning 1
)
select is((select count(*) from deleted)::int, 0, 'A cannot delete B''s transaction');

-- …and a write labelled as B's must be refused outright.
select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, category_id, note, occurred_at
    )
    values (
      'bbbbbbbb-0000-4000-8000-000000000001', 'expense', 1000,
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003', 'forged', now()
    )
  $$,
  '42501',
  null,
  'A cannot insert a row owned by B'
);

select throws_ok(
  $$
    update public.transactions
    set user_id = 'bbbbbbbb-0000-4000-8000-000000000001'
    where id = 'a0000000-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'A cannot hand their own transaction to B'
);

-- The ownership trigger covers what RLS alone cannot: a row that is mine but
-- points at someone else's account.
select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, amount, account_id, category_id, note, occurred_at
    )
    values (
      'aaaaaaaa-0000-4000-8000-000000000001', 'expense', 1000,
      'b0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003', 'wrong account', now()
    )
  $$,
  '42501',
  null,
  'A cannot book a transaction against B''s account'
);

select is(
  (select total_expense from public.month_summary(current_date)),
  25000::bigint,
  'month_summary only counts the caller''s own spending'
);

-- ------------------------------------------------- user B's point of view --

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.transactions)::int,
  1,
  'B sees exactly their own transaction, and A has not touched it'
);

-- -------------------------------------------------------------- anonymous --

reset role;
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$ select count(*) from public.transactions $$,
  '42501',
  null,
  'an anonymous session is refused outright'
);

reset role;

select * from finish();

rollback;
