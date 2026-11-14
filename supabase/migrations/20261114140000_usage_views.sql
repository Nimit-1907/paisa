-- Paisa: what is using an account or a category.
--
-- The management screens need this before they can offer a delete: an account
-- or category that something points at must be archived instead, and the
-- delete has to be refused server-side too. Counting in the client would mean
-- pulling every transaction just to find out whether there is one.
--
-- Both views are security_invoker, so the caller's RLS policies apply and the
-- counts only ever cover their own rows.

create view public.account_usage
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  (
    select count(*)
    from public.transactions t
    where t.account_id = a.id
       or t.to_account_id = a.id
  )::integer as transaction_count,
  (
    select count(*)
    from public.recurring_rules r
    where r.account_id = a.id
       or r.to_account_id = a.id
  )::integer as recurring_rule_count
from public.accounts a;

comment on view public.account_usage is
  'Per account: how many transactions and recurring rules reference it.';

create view public.category_usage
with (security_invoker = true)
as
select
  c.id as category_id,
  c.user_id,
  (
    select count(*)
    from public.transactions t
    where t.category_id = c.id
  )::integer as transaction_count,
  (
    select count(*)
    from public.budgets b
    where b.category_id = c.id
  )::integer as budget_count,
  (
    select count(*)
    from public.recurring_rules r
    where r.category_id = c.id
  )::integer as recurring_rule_count
from public.categories c;

comment on view public.category_usage is
  'Per category: how many transactions, budgets and recurring rules reference it.';

grant select on table public.account_usage, public.category_usage to authenticated;
revoke all on table public.account_usage, public.category_usage from anon;
