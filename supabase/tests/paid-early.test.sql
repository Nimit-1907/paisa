-- Paisa: deleting a payment made early puts it back on the schedule.
--
--     supabase test db
--
-- "Pay now" on an occurrence still to come records it and moves the rule
-- on. Deleting that record (Undo, or a mistake) used to leave the rule
-- moved on, so the payment vanished: never created, never skipped.

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
  'b9999999-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'paidearly@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.accounts (id, user_id, name, type)
values ('b9000000-0000-4000-8000-000000000010',
        'b9999999-0000-4000-8000-000000000001', 'Bank', 'bank');

-- Weekly, first due in three days.
insert into public.recurring_rules (
  id, user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'b9000000-0000-4000-8000-000000000100',
       'b9999999-0000-4000-8000-000000000001', 'expense', 25000,
       'b9000000-0000-4000-8000-000000000010', c.id, 'Metro',
       'weekly', 1, current_date + 3, current_date + 3
from public.categories c
where c.user_id = 'b9999999-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Transport';

-- Weekly, last due four days ago and already recorded then.
insert into public.recurring_rules (
  id, user_id, type, amount, account_id, category_id, note,
  frequency, interval_count, start_date, next_run_on
)
select 'b9000000-0000-4000-8000-000000000101',
       'b9999999-0000-4000-8000-000000000001', 'expense', 99900,
       'b9000000-0000-4000-8000-000000000010', c.id, 'Gym',
       'weekly', 1, current_date - 4, current_date + 3
from public.categories c
where c.user_id = 'b9999999-0000-4000-8000-000000000001'
  and c.kind = 'expense' and c.name = 'Transport';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b9999999-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.transactions (
  user_id, type, amount, account_id, category_id, note, occurred_at,
  recurring_rule_id
)
select 'b9999999-0000-4000-8000-000000000001', 'expense', 99900,
       'b9000000-0000-4000-8000-000000000010', r.category_id, 'Gym',
       ((current_date - 4) + time '12:00')::timestamp
         at time zone public.user_timezone(),
       r.id
from public.recurring_rules r
where r.id = 'b9000000-0000-4000-8000-000000000101';

-- Pay the metro early: the rule moves on a week.
select public.materialise_recurring(
  'b9000000-0000-4000-8000-000000000100', current_date + 3
);

select is(
  (select next_run_on from public.recurring_rules
    where id = 'b9000000-0000-4000-8000-000000000100'),
  current_date + 10,
  'paying early moves the rule on'
);

delete from public.transactions
 where recurring_rule_id = 'b9000000-0000-4000-8000-000000000100';

select is(
  (select next_run_on from public.recurring_rules
    where id = 'b9000000-0000-4000-8000-000000000100'),
  current_date + 3,
  'deleting the early payment puts it back on the schedule'
);

-- A payment whose day has come and gone is a record somebody deleted on
-- purpose: putting it back would recreate it on the next page load.
delete from public.transactions
 where recurring_rule_id = 'b9000000-0000-4000-8000-000000000101';

select is(
  (select next_run_on from public.recurring_rules
    where id = 'b9000000-0000-4000-8000-000000000101'),
  current_date + 3,
  'deleting a past payment leaves the schedule alone'
);

select * from finish();
rollback;
