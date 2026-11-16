-- Paisa: Add Record's account guess, per type.
--
--     supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'b8888888-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'entrydefaults@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.accounts (id, user_id, name, type) values
  ('b8000000-0000-4000-8000-0000000000a1', 'b8888888-0000-4000-8000-000000000001', 'Bank',   'bank'),
  ('b8000000-0000-4000-8000-0000000000a2', 'b8888888-0000-4000-8000-000000000001', 'Card',   'card'),
  ('b8000000-0000-4000-8000-0000000000a3', 'b8888888-0000-4000-8000-000000000001', 'Wallet', 'wallet'),
  ('b8000000-0000-4000-8000-0000000000a4', 'b8888888-0000-4000-8000-000000000001', 'Old',    'cash'),
  ('b8000000-0000-4000-8000-0000000000a5', 'b8888888-0000-4000-8000-000000000001', 'Gone',   'bank');

-- An older expense on Card, then the newest expense on Old.
insert into public.transactions (user_id, type, amount, account_id, category_id, occurred_at)
select 'b8888888-0000-4000-8000-000000000001', 'expense', 10000,
       'b8000000-0000-4000-8000-0000000000a2', c.id, now() - interval '2 days'
from public.categories c
where c.user_id = 'b8888888-0000-4000-8000-000000000001' and c.kind = 'expense'
limit 1;

insert into public.transactions (user_id, type, amount, account_id, category_id, occurred_at)
select 'b8888888-0000-4000-8000-000000000001', 'expense', 20000,
       'b8000000-0000-4000-8000-0000000000a4', c.id, now() - interval '1 day'
from public.categories c
where c.user_id = 'b8888888-0000-4000-8000-000000000001' and c.kind = 'expense'
limit 1;

-- Income into Bank, newer than every expense.
insert into public.transactions (user_id, type, amount, account_id, category_id, occurred_at)
select 'b8888888-0000-4000-8000-000000000001', 'income', 500000,
       'b8000000-0000-4000-8000-0000000000a1', c.id, now() - interval '1 hour'
from public.categories c
where c.user_id = 'b8888888-0000-4000-8000-000000000001' and c.kind = 'income'
limit 1;

-- A transfer from Bank to Wallet.
insert into public.transactions (user_id, type, amount, account_id, to_account_id, occurred_at)
values ('b8888888-0000-4000-8000-000000000001', 'transfer', 30000,
        'b8000000-0000-4000-8000-0000000000a1',
        'b8000000-0000-4000-8000-0000000000a3', now() - interval '3 hours');

-- A newer transfer from Gone into Bank. Gone is archived below, so this
-- whole transfer is passed over: taking its To (Bank) with the older
-- transfer's From (Bank) would start a transfer from Bank to Bank.
insert into public.transactions (user_id, type, amount, account_id, to_account_id, occurred_at)
values ('b8888888-0000-4000-8000-000000000001', 'transfer', 40000,
        'b8000000-0000-4000-8000-0000000000a5',
        'b8000000-0000-4000-8000-0000000000a1', now() - interval '2 hours');

-- Old and Gone are archived after their records: neither may be guessed.
update public.accounts set archived = true
 where id in ('b8000000-0000-4000-8000-0000000000a4',
              'b8000000-0000-4000-8000-0000000000a5');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (public.entry_defaults()->'lastAccounts'->>'expense')::uuid,
  'b8000000-0000-4000-8000-0000000000a2'::uuid,
  'an expense starts on the last expense account that is still open'
);

select is(
  (public.entry_defaults()->'lastAccounts'->>'income')::uuid,
  'b8000000-0000-4000-8000-0000000000a1'::uuid,
  'income starts on the last income account, not the last account of all'
);

select is(
  array[
    (public.entry_defaults()->'lastAccounts'->>'transfer')::uuid,
    (public.entry_defaults()->'lastAccounts'->>'transferTo')::uuid
  ],
  array[
    'b8000000-0000-4000-8000-0000000000a1'::uuid,
    'b8000000-0000-4000-8000-0000000000a3'::uuid
  ],
  'a transfer starts from and to one transfer''s accounts, both still open'
);

select ok(
  not (public.entry_defaults() ? 'lastAccountId'),
  'the one-account-for-everything guess is gone'
);

select * from finish();
rollback;
