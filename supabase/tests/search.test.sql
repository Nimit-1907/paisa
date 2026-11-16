-- Paisa: the totals behind a note search.
--
--     supabase test db
--
-- `search_totals` exists because the search screen caps its list at a
-- hundred rows. The figure above that list is over *every* match, so the
-- two have to agree about what matches, which means the escaping, the
-- transfer rule and the row-level security all have to line up.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'ffffffff-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'searcher@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'ffffffff-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'stranger@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(), '', '', '', '');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"ffffffff-0000-4000-8000-00000000000a","role":"authenticated"}';

insert into public.accounts (id, user_id, name, type, initial_balance)
values
  ('f0000000-0000-4000-8000-0000000000a1',
   'ffffffff-0000-4000-8000-00000000000a', 'Bank', 'bank', 0),
  ('f0000000-0000-4000-8000-0000000000a2',
   'ffffffff-0000-4000-8000-00000000000a', 'Wallet', 'wallet', 0);

insert into public.categories (id, user_id, name, kind, icon)
values
  ('f0000000-0000-4000-8000-0000000000c1',
   'ffffffff-0000-4000-8000-00000000000a', 'Housing', 'expense', 'House'),
  ('f0000000-0000-4000-8000-0000000000c2',
   'ffffffff-0000-4000-8000-00000000000a', 'Refunds', 'income', 'Gift');

insert into public.transactions
  (user_id, type, amount, note, occurred_at, account_id, to_account_id,
   category_id)
values
  -- Three expenses, one income, spread over three months.
  ('ffffffff-0000-4000-8000-00000000000a', 'expense', 2200000,
   'Rent, landlord UPI', '2026-09-03T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c1'),
  ('ffffffff-0000-4000-8000-00000000000a', 'expense', 2200000,
   'Rent, landlord UPI', '2026-10-03T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c1'),
  ('ffffffff-0000-4000-8000-00000000000a', 'expense', 2200000,
   'rent, paid late', '2026-11-03T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c1'),
  ('ffffffff-0000-4000-8000-00000000000a', 'income', 500000,
   'Rent refund', '2026-11-05T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c2'),
  -- A transfer that matches the term, and must count for neither side.
  ('ffffffff-0000-4000-8000-00000000000a', 'transfer', 900000,
   'rent float', '2026-11-06T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1',
   'f0000000-0000-4000-8000-0000000000a2', null),
  -- Wildcards as literal text, to prove the escaping.
  ('ffffffff-0000-4000-8000-00000000000a', 'expense', 100000,
   '100% cotton', '2026-11-07T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c1'),
  ('ffffffff-0000-4000-8000-00000000000a', 'expense', 200000,
   '100 rupees cotton', '2026-11-08T06:00:00Z',
   'f0000000-0000-4000-8000-0000000000a1', null,
   'f0000000-0000-4000-8000-0000000000c1');

-- ---------------------------------------------------------------- tests ----

select is(
  (select match_count from public.search_totals('rent')),
  5,
  'counts every match, whatever its type, case-insensitively'
);

select is(
  (select expense from public.search_totals('rent')),
  6600000::bigint,
  'sums only the expenses'
);

select is(
  (select income from public.search_totals('rent')),
  500000::bigint,
  'sums only the income'
);

-- The transfer is in the count because it matched, but in neither total:
-- it moved money between the user's own accounts.
select is(
  (select income + expense from public.search_totals('rent')),
  7100000::bigint,
  'a matching transfer is counted but adds to neither total'
);

-- `%` escaped by the caller is a literal per cent, not "anything".
select is(
  (select match_count from public.search_totals('100\%')),
  1,
  'an escaped per cent matches the note that contains one'
);

select is(
  (select match_count from public.search_totals('100%')),
  2,
  'an unescaped per cent is still a wildcard, which is why the caller escapes'
);

select is(
  (select match_count from public.search_totals('nothing like this')),
  0,
  'a term nobody wrote matches nothing'
);

-- --------------------------------------------------------------- the RLS ---

set local request.jwt.claims =
  '{"sub":"ffffffff-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select match_count from public.search_totals('rent')),
  0,
  'another user sees none of it'
);

reset role;

select * from finish();

rollback;
