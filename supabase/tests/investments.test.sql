-- Paisa: the investments ledger.
--
--     supabase test db
--
-- The shape rules per kind, the totals view, the instalment engine (catch
-- up, idempotent, pause, skip, end date), the payout, a deleted goal, and
-- that one user can neither see nor write into another's ledger.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

-- ------------------------------------------------------------- fixtures ----

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'investor@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'other-investor@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(), '', '', '', '');

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.investment_goals'::regclass,
                  'public.investments'::regclass,
                  'public.investment_entries'::regclass)),
  'all three investment tables have row level security'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}';

-- "Today" as the engine sees it, in the user's own timezone.
create temp table t_today as
  select (now() at time zone public.user_timezone())::date as d;

insert into public.investment_goals (id, user_id, name, tint, target_amount)
values ('e0000000-0000-4000-8000-0000000000a1',
        'eeeeeeee-0000-4000-8000-000000000001', 'Retirement', 'peri', 100000000);

-- ------------------------------------------------------- shape per kind ----

select throws_ok(
  $$ insert into public.investments (user_id, kind, name)
     values ('eeeeeeee-0000-4000-8000-000000000001', 'sip', 'No schedule') $$,
  '23514', null,
  'a SIP must have a schedule'
);

select throws_ok(
  $$ insert into public.investments (user_id, kind, name)
     values ('eeeeeeee-0000-4000-8000-000000000001', 'fd', 'No maturity') $$,
  '23514', null,
  'an FD must have a maturity date'
);

select throws_ok(
  $$ insert into public.investments (
       user_id, kind, name, sched_amount, frequency, interval_count,
       start_date, next_run_on)
     values ('eeeeeeee-0000-4000-8000-000000000001', 'stock', 'Repeating stock',
             500000, 'monthly', 1, current_date, current_date) $$,
  '23514', null,
  'stocks cannot repeat'
);

select throws_ok(
  $$ insert into public.investments (user_id, kind, name, maturity_date)
     values ('eeeeeeee-0000-4000-8000-000000000001', 'gold', 'Gold FD',
             current_date + 30) $$,
  '23514', null,
  'only deposits have a maturity'
);

select lives_ok(
  $$ insert into public.investments (user_id, kind, name)
     values ('eeeeeeee-0000-4000-8000-000000000001', 'ppf', 'PPF, by hand') $$,
  'a PPF may go without a schedule'
);

-- ----------------------------------------------------------- the engine ----

-- A SIP that began on the 1st two months ago owes three instalments: the
-- 1st of each of the last three months, this one included.
insert into public.investments (
  id, user_id, kind, name, goal_id, sched_amount, frequency, interval_count,
  start_date, next_run_on
)
select 'e0000000-0000-4000-8000-0000000000b1',
       'eeeeeeee-0000-4000-8000-000000000001', 'sip', 'Flexi cap',
       'e0000000-0000-4000-8000-0000000000a1', 1000000, 'monthly', 1,
       (date_trunc('month', d) - interval '2 months')::date,
       (date_trunc('month', d) - interval '2 months')::date
from t_today;

-- Paused: owes the same, posts nothing.
insert into public.investments (
  id, user_id, kind, name, sched_amount, frequency, interval_count,
  start_date, next_run_on, paused
)
select 'e0000000-0000-4000-8000-0000000000b2',
       'eeeeeeee-0000-4000-8000-000000000001', 'sip', 'Paused SIP',
       500000, 'monthly', 1,
       (date_trunc('month', d) - interval '2 months')::date,
       (date_trunc('month', d) - interval '2 months')::date, true
from t_today;

-- An RD that began three months ago and ended after two instalments.
insert into public.investments (
  id, user_id, kind, name, sched_amount, frequency, interval_count,
  start_date, next_run_on, end_date, installments_total, maturity_date,
  maturity_amount
)
select 'e0000000-0000-4000-8000-0000000000b3',
       'eeeeeeee-0000-4000-8000-000000000001', 'rd', 'Short RD',
       300000, 'monthly', 1,
       (date_trunc('month', d) - interval '3 months')::date,
       (date_trunc('month', d) - interval '3 months')::date,
       (date_trunc('month', d) - interval '2 months')::date, 2,
       (date_trunc('month', d) - interval '2 months')::date, 610000
from t_today;

select is(
  public.process_due_investments(),
  5,
  'catch-up posts 3 SIP instalments and 2 RD instalments, none for the paused SIP'
);

select is(
  public.process_due_investments(),
  0,
  'a second run posts nothing'
);

select is(
  (select count(*)::int from public.investment_entries
    where investment_id = 'e0000000-0000-4000-8000-0000000000b2'),
  0,
  'a paused schedule posted nothing'
);

select is(
  (select count(*)::int from public.investment_entries
    where investment_id = 'e0000000-0000-4000-8000-0000000000b3'),
  2,
  'the RD stopped at its end date'
);

select is(
  (select next_run_on from public.investments
    where id = 'e0000000-0000-4000-8000-0000000000b1'),
  (select (date_trunc('month', d) + interval '1 month')::date from t_today),
  'the SIP now waits for the 1st of next month'
);

-- ------------------------------------------------------------------ skip ---

select is(
  public.skip_investment_installment('e0000000-0000-4000-8000-0000000000b1'),
  (select (date_trunc('month', d) + interval '2 months')::date from t_today),
  'skipping moves the SIP to the month after next'
);

select ok(
  (select (date_trunc('month', t.d) + interval '1 month')::date = any (i.skipped_dates)
     from public.investments i, t_today t
    where i.id = 'e0000000-0000-4000-8000-0000000000b1'),
  'and remembers the skipped date'
);

-- ----------------------------------------------------------------- totals --

insert into public.investment_entries (user_id, investment_id, type, amount, occurred_on)
select 'eeeeeeee-0000-4000-8000-000000000001',
       'e0000000-0000-4000-8000-0000000000b1', 'redeem', 1200000, d
from t_today;

select results_eq(
  $$ select invested, redeemed, net, entry_count
       from public.investment_summary
      where investment_id = 'e0000000-0000-4000-8000-0000000000b1' $$,
  $$ values (3000000::bigint, 1200000::bigint, 1800000::bigint, 4) $$,
  'the summary adds invests, redeems and their difference'
);

-- ---------------------------------------------------------------- payout ---

insert into public.investments (
  id, user_id, kind, name, maturity_date, maturity_amount, interest_rate,
  tenure_months
)
values ('e0000000-0000-4000-8000-0000000000c1',
        'eeeeeeee-0000-4000-8000-000000000001', 'fd', 'SBI FD',
        current_date, 21461800, 7.10, 12);

insert into public.investment_entries (user_id, investment_id, type, amount, occurred_on)
values ('eeeeeeee-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-0000000000c1', 'invest', 20000000,
        current_date - 365);

select isnt(
  public.record_investment_payout(
    'e0000000-0000-4000-8000-0000000000c1', 21461800, current_date, true),
  null,
  'a payout returns its entry'
);

select results_eq(
  $$ select i.status, s.net
       from public.investments i
       join public.investment_summary s on s.investment_id = i.id
      where i.id = 'e0000000-0000-4000-8000-0000000000c1' $$,
  $$ values ('closed'::text, (-1461800)::bigint) $$,
  'the FD is closed, with more redeemed than invested'
);

-- A closed investment's schedule stops posting.
update public.investments
set status = 'closed', closed_on = current_date,
    next_run_on = (select (date_trunc('month', d) - interval '1 month')::date from t_today)
where id = 'e0000000-0000-4000-8000-0000000000b1';

select is(
  public.process_due_investments(),
  0,
  'a closed schedule posts nothing'
);

-- ------------------------------------------------------------- goal gone ---

delete from public.investment_goals
where id = 'e0000000-0000-4000-8000-0000000000a1';

select is(
  (select goal_id from public.investments
    where id = 'e0000000-0000-4000-8000-0000000000b1'),
  null,
  'deleting a goal leaves its investments under no goal'
);

-- ------------------------------------------------------------------ RLS ----

set local request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.investments),
  0,
  'another user sees none of the investments'
);

select is(
  (select count(*)::int from public.investment_entries),
  0,
  'or their entries'
);

select throws_ok(
  $$ insert into public.investment_entries (user_id, investment_id, type, amount, occurred_on)
     values ('eeeeeeee-0000-4000-8000-000000000002',
             'e0000000-0000-4000-8000-0000000000b1', 'invest', 100, current_date) $$,
  '42501', null,
  'and cannot write into someone else''s investment'
);

select throws_ok(
  $$ select public.skip_investment_installment('e0000000-0000-4000-8000-0000000000b1') $$,
  'P0002', null,
  'or skip their instalments'
);

select * from finish();

rollback;
