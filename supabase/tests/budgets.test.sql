-- Paisa: the budget writes that span more than one month.
--
--     supabase test db
--
-- "Apply to all future months" has to carry a change forward without
-- flattening a month the user already decided about, and "copy last month"
-- has to be safe to press twice. Both are easy to get subtly wrong and
-- expensive to notice: a budget quietly overwritten is only found when the
-- month is already over.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'budgets@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now(), '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';

-- The month everything below is measured from.
create temporary table anchor as
select date_trunc('month', current_date)::date as m;

create temporary table cat as
select
  (select c.id from public.categories c
    where c.user_id = 'eeeeeeee-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Food') as food,
  (select c.id from public.categories c
    where c.user_id = 'eeeeeeee-0000-4000-8000-000000000001'
      and c.kind = 'expense' and c.name = 'Rent') as rent,
  (select c.id from public.categories c
    where c.user_id = 'eeeeeeee-0000-4000-8000-000000000001'
      and c.kind = 'income' and c.name = 'Salary') as salary;

-- ------------------------------------------------------- one month only ----

select is(
  (select public.set_budget(c.food, a.m, 500000::bigint) from cat c, anchor a),
  1,
  'setting a budget writes exactly one month'
);

select is(
  (select amount from public.budgets b, cat c, anchor a
    where b.category_id = c.food and b.month = a.m),
  500000::bigint,
  '…with the amount asked for'
);

select is(
  (select public.set_budget(c.food, a.m, 600000::bigint) from cat c, anchor a),
  1,
  'setting it again is an update, not a second row'
);

select is(
  (select count(*)::int from public.budgets b, cat c where b.category_id = c.food),
  1,
  '…and there is still only one row'
);

-- A date mid-month is normalised rather than rejected: the column only
-- accepts the first, and the caller should not have to know that.
select is(
  (select public.set_budget(c.rent, a.m + 17, 2200000::bigint) from cat c, anchor a),
  1,
  'a date inside the month is accepted'
);

select is(
  (select month from public.budgets b, cat c where b.category_id = c.rent),
  (select m from anchor),
  '…and stored against the first of it'
);

select throws_ok(
  $$
    select public.set_budget(
      (select food from cat), (select m from anchor), 0::bigint
    )
  $$,
  '22023',
  null,
  'a budget of zero is refused'
);

-- An income category has no business having a budget; the trigger says so.
select throws_ok(
  $$
    select public.set_budget(
      (select salary from cat), (select m from anchor), 100000::bigint
    )
  $$,
  '23514',
  null,
  'a budget on an income category is refused'
);

-- -------------------------------------------------------- apply forward ----

select is(
  (select public.set_budget(c.food, a.m, 700000::bigint, true, 12)
     from cat c, anchor a),
  13,
  'applying forward writes this month and the next twelve'
);

select is(
  (select count(*)::int from public.budgets b, cat c, anchor a
    where b.category_id = c.food and b.amount = 700000 and b.month >= a.m),
  13,
  '…all at the new amount'
);

-- The month someone has decided about by hand is where the run ends.
update public.budgets
set amount = 999000
where category_id = (select food from cat)
  and month = (select m + interval '3 months' from anchor)::date;

select is(
  (select public.set_budget(c.food, a.m, 800000::bigint, true, 12)
     from cat c, anchor a),
  3,
  'carrying forward stops at a month that was set to something else'
);

select is(
  (select amount from public.budgets b, cat c, anchor a
    where b.category_id = c.food
      and b.month = (a.m + interval '3 months')::date),
  999000::bigint,
  '…and leaves that month exactly as it was'
);

select is(
  (select amount from public.budgets b, cat c, anchor a
    where b.category_id = c.food
      and b.month = (a.m + interval '4 months')::date),
  700000::bigint,
  '…and does not reach past it either'
);

-- ------------------------------------------------------------- copying ----

-- Food already has next month from the run above; Rent does not, so it is
-- the only thing to bring over.
select is(
  (select public.copy_budgets_from_previous_month(
     (a.m + interval '1 month')::date) from anchor a),
  1,
  'copying brings over only the categories with no budget yet'
);

select is(
  (select public.copy_budgets_from_previous_month(
     (a.m + interval '1 month')::date) from anchor a),
  0,
  '…and pressing it twice copies nothing the second time'
);

-- A category that has since been archived still has last month's budget, and
-- must not be carried into a month where it cannot even be chosen.
insert into public.categories (id, user_id, name, kind, archived)
values ('e0000000-0000-4000-8000-000000000020',
        'eeeeeeee-0000-4000-8000-000000000001', 'Old hobby', 'expense', false);

insert into public.budgets (user_id, category_id, month, amount)
select 'eeeeeeee-0000-4000-8000-000000000001',
       'e0000000-0000-4000-8000-000000000020',
       (a.m + interval '1 month')::date, 150000
from anchor a;

update public.categories
set archived = true
where id = 'e0000000-0000-4000-8000-000000000020';

select is(
  (select public.copy_budgets_from_previous_month(
     (a.m + interval '2 months')::date) from anchor a),
  1,
  'copying again brings over only Rent'
);

select is(
  (select count(*)::int from public.budgets b, anchor a
    where b.month = (a.m + interval '2 months')::date
      and b.category_id = 'e0000000-0000-4000-8000-000000000020'),
  0,
  '…and never an archived category'
);

reset role;

select * from finish();

rollback;
