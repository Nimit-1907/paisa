-- Paisa: deleting your own account.
--
--     supabase test db
--
-- The one irreversible thing in the app. It has to take everything that
-- belongs to the caller, the cascades are what do that, and a missing one
-- would leave orphaned rows nobody can reach or delete, and it has to be
-- incapable of touching anyone else.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'a9999999-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'leaving@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a9999999-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'staying@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', '');

-- Give the leaver one of everything, so every cascade is exercised.
insert into public.accounts (id, user_id, name, type)
values ('a9000000-0000-4000-8000-000000000010',
        'a9999999-0000-4000-8000-000000000001', 'Bank', 'bank');

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'a9999999-0000-4000-8000-000000000001', 'expense', 50000,
       'a9000000-0000-4000-8000-000000000010', c.id, 'Leaving expense', now()
from public.categories c
where c.user_id = 'a9999999-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.budgets (user_id, category_id, month, amount)
select 'a9999999-0000-4000-8000-000000000001', c.id,
       date_trunc('month', current_date)::date, 500000
from public.categories c
where c.user_id = 'a9999999-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

insert into public.recurring_rules (
  user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'a9999999-0000-4000-8000-000000000001', 'expense', 100000,
       'a9000000-0000-4000-8000-000000000010', c.id, 'Leaving rule',
       'monthly', 1, current_date, current_date + 30
from public.categories c
where c.user_id = 'a9999999-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Rent';

select ok(
  (select count(*) from public.transactions
    where user_id = 'a9999999-0000-4000-8000-000000000001') = 1,
  'the leaver starts with a record'
);

-- ------------------------------------------- the password-check throttle ---

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a9999999-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.claim_password_attempt(),
  4,
  'the first attempt leaves four'
);

select is(
  (select public.claim_password_attempt()
     from generate_series(1, 4) limit 1 offset 3),
  0,
  'the fifth attempt leaves none'
);

select throws_ok(
  $$ select public.claim_password_attempt() $$,
  '53400',
  null,
  'the sixth is refused, a stolen session is not a guessing machine'
);

-- There is no reset to call: one would be callable by the same stolen
-- session the limit exists to stop, so the window expiring is the only way
-- back.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'clear_password_attempts'),
  0,
  'and there is no client-callable way to reset the count'
);

-- Winding the clock back has to be done as the owner, because the column is
-- exactly the one the user may not write, which is the point.
reset role;

update public.profiles
set password_attempt_window = now() - interval '20 minutes'
where id = 'a9999999-0000-4000-8000-000000000001';

set local role authenticated;

select is(
  public.claim_password_attempt(),
  4,
  'once the window has passed, the attempts come back'
);

select throws_ok(
  $$
    update public.profiles set password_attempts = 0
    where id = 'a9999999-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  '…and the user cannot wind it back themselves'
);

reset role;

-- -------------------------------------------------------- the deletion -----

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a9999999-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_own_account() $$,
  'a signed-in user can delete their own account'
);

reset role;

select is(
  (select count(*)::int from auth.users
    where id = 'a9999999-0000-4000-8000-000000000001'),
  0,
  'the auth user is gone'
);

select is(
  (select count(*)::int from public.profiles
    where id = 'a9999999-0000-4000-8000-000000000001'),
  0,
  '…and so is the profile'
);

select is(
  (select count(*)::int
     from (
       select 1 from public.accounts
        where user_id = 'a9999999-0000-4000-8000-000000000001'
       union all
       select 1 from public.categories
        where user_id = 'a9999999-0000-4000-8000-000000000001'
       union all
       select 1 from public.transactions
        where user_id = 'a9999999-0000-4000-8000-000000000001'
       union all
       select 1 from public.budgets
        where user_id = 'a9999999-0000-4000-8000-000000000001'
       union all
       select 1 from public.recurring_rules
        where user_id = 'a9999999-0000-4000-8000-000000000001'
     ) leftovers),
  0,
  '…and every row that belonged to them, in every table'
);

-- ------------------------------------------------- everyone else is fine ---

select is(
  (select count(*)::int from auth.users
    where id = 'a9999999-0000-4000-8000-000000000002'),
  1,
  'the other user is untouched'
);

select ok(
  (select count(*) from public.categories
    where user_id = 'a9999999-0000-4000-8000-000000000002') > 0,
  '…and still has their categories'
);

-- There is no argument to pass, so there is no id to get wrong; without a
-- session there is nobody to delete either.
--
-- `reset role` above puts the role back but leaves the claims behind, so the
-- session has to be cleared explicitly for auth.uid() to be null.
set local request.jwt.claims = '';

select throws_ok(
  $$ select public.delete_own_account() $$,
  '42501',
  null,
  'an unauthenticated call is refused'
);

select * from finish();

rollback;
