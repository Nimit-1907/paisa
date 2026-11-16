-- Paisa: a record's type is fixed once it is saved.
--
--     supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'b7777777-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'typefixed@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.accounts (id, user_id, name, type)
values ('b7000000-0000-4000-8000-000000000010',
        'b7777777-0000-4000-8000-000000000001', 'Bank', 'bank');

insert into public.transactions (
  id, user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'b7000000-0000-4000-8000-0000000000f1',
       'b7777777-0000-4000-8000-000000000001', 'expense', 45000,
       'b7000000-0000-4000-8000-000000000010', c.id, 'Lunch', now()
from public.categories c
where c.user_id = 'b7777777-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Food';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b7777777-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    update public.transactions
       set type = 'income',
           category_id = (select id from public.categories
                           where kind = 'income' limit 1)
     where id = 'b7000000-0000-4000-8000-0000000000f1'
  $$,
  '22023',
  null,
  'an expense cannot become income'
);

select lives_ok(
  $$
    update public.transactions
       set amount = 52000, note = 'Lunch, team'
     where id = 'b7000000-0000-4000-8000-0000000000f1'
  $$,
  'its details can still be edited'
);

select is(
  (select type::text from public.transactions
    where id = 'b7000000-0000-4000-8000-0000000000f1'),
  'expense',
  'and it is still an expense'
);

select * from finish();
rollback;
