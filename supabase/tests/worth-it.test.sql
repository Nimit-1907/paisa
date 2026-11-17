-- Paisa: "Worth it?" on a spend, and the month's regretted total.
--
--     supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'b8888888-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'worthit@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b8888888-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'worthit2@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', '');

insert into public.accounts (id, user_id, name, type)
values ('b8000000-0000-4000-8000-000000000010',
        'b8888888-0000-4000-8000-000000000001', 'Bank', 'bank'),
       ('b8000000-0000-4000-8000-000000000020',
        'b8888888-0000-4000-8000-000000000002', 'Bank', 'bank');

-- Two spends and an income this month for the first user, and a regretted
-- spend for the second that must not count towards the first.
insert into public.transactions (
  id, user_id, type, amount, account_id, category_id, note, occurred_at, worth_it
)
select v.id::uuid, v.user_id::uuid, v.type::public.transaction_type, v.amount,
       v.account_id::uuid, c.id, v.note, now(), v.worth_it
from (values
  ('b8000000-0000-4000-8000-0000000000f1', 'b8888888-0000-4000-8000-000000000001',
   'expense', 45000, 'b8000000-0000-4000-8000-000000000010', 'Food', 'Pizza', false),
  ('b8000000-0000-4000-8000-0000000000f2', 'b8888888-0000-4000-8000-000000000001',
   'expense', 12000, 'b8000000-0000-4000-8000-000000000010', 'Food', 'Thali', true),
  ('b8000000-0000-4000-8000-0000000000f3', 'b8888888-0000-4000-8000-000000000002',
   'expense', 99900, 'b8000000-0000-4000-8000-000000000020', 'Food', 'Not mine', false)
) as v(id, user_id, type, amount, account_id, cat, note, worth_it)
join public.categories c
  on c.user_id = v.user_id::uuid and c.kind = 'expense' and c.name = v.cat;

insert into public.transactions (
  id, user_id, type, amount, account_id, category_id, note, occurred_at
)
select 'b8000000-0000-4000-8000-0000000000f4',
       'b8888888-0000-4000-8000-000000000001', 'income', 500000,
       'b8000000-0000-4000-8000-000000000010', c.id, 'Salary', now()
from public.categories c
where c.user_id = 'b8888888-0000-4000-8000-000000000001' and c.kind = 'income'
limit 1;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select worth_it from public.transactions
    where id = 'b8000000-0000-4000-8000-0000000000f1'),
  false,
  'a spend can be marked as a regret'
);

select throws_ok(
  $$
    update public.transactions set worth_it = true
     where id = 'b8000000-0000-4000-8000-0000000000f4'
  $$,
  '23514',
  null,
  'only a spend can be worth it or not'
);

select lives_ok(
  $$
    update public.transactions set worth_it = null
     where id = 'b8000000-0000-4000-8000-0000000000f2'
  $$,
  'a tag can be taken off'
);

select is(
  public.month_regret(current_date),
  45000::bigint,
  'the month''s regret is the regretted spends, and only this user''s'
);

select is(
  public.month_regret((current_date - interval '1 month')::date),
  0::bigint,
  'a month with no regrets is zero, not null'
);

select * from finish();
rollback;
