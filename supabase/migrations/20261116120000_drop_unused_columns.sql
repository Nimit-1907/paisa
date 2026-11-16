-- Drops the two columns nothing reads any more.
--
-- `accounts.color` and `categories.color` held a hex colour from before
-- Phase 14; the sixteen tints replaced them and every screen reads `tint`.
-- `profiles.recap_seen_for` remembered which month's recap card had been
-- dismissed, and the recap card is gone.
--
-- The view and the functions that still carried `color` through are
-- recreated first without it. Functions whose result type changes have to
-- be dropped rather than replaced; their grants are restored below.

drop view if exists public.account_balances;

drop function if exists public.category_totals(date, date, public.category_kind);
drop function if exists public.quick_adds();
drop function if exists public.default_categories();

alter table public.accounts drop column if exists color;
alter table public.categories drop column if exists color;
alter table public.profiles drop column if exists recap_seen_for;

create view public.account_balances
with (security_invoker = true) as
with movements as (
  select
    t.user_id,
    t.account_id,
    case when t.type = 'income' then t.amount else -t.amount end as delta
  from public.transactions t
  union all
  select
    t.user_id,
    t.to_account_id as account_id,
    t.amount as delta
  from public.transactions t
  where t.type = 'transfer' and t.to_account_id is not null
)
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.icon,
  a.include_in_total,
  a.archived,
  a.sort_order,
  a.initial_balance,
  (a.initial_balance::numeric + coalesce(sum(m.delta), 0))::bigint as balance,
  count(m.delta)::integer as movement_count
from public.accounts a
left join movements m on m.account_id = a.id and m.user_id = a.user_id
group by a.id;

comment on view public.account_balances is
  'Per-account current balance: initial_balance + income - expense - transfers out + transfers in.';

grant select on table public.account_balances to authenticated;
revoke all on table public.account_balances from anon;

CREATE OR REPLACE FUNCTION public.month_summary(p_month date)
 RETURNS TABLE(month_start date, total_income bigint, total_expense bigint, net bigint, categories jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with settings as (
    select
      public.user_timezone() as tz,
      date_trunc('month', p_month::timestamp)::date as month_start
  ),
  bounds as (
    select
      s.month_start,
      -- Compared as timestamptz so the index on (user_id, occurred_at) is
      -- usable, and so a 11pm IST purchase on the 31st stays in its month.
      (s.month_start::timestamp at time zone s.tz) as starts_at,
      ((s.month_start + interval '1 month')::timestamp at time zone s.tz)
        as ends_at
    from settings s
  ),
  scoped as (
    select t.*
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.occurred_at >= b.starts_at
      and t.occurred_at < b.ends_at
  ),
  totals as (
    select
      coalesce(sum(s.amount) filter (where s.type = 'income'), 0)::bigint
        as total_income,
      coalesce(sum(s.amount) filter (where s.type = 'expense'), 0)::bigint
        as total_expense
    from scoped s
  ),
  by_category as (
    select
      c.id,
      c.name,
      c.icon,
      sum(s.amount)::bigint as total
    from scoped s
    join public.categories c on c.id = s.category_id
    where s.type = 'expense'
    group by c.id, c.name, c.icon
  )
  select
    b.month_start,
    t.total_income,
    t.total_expense,
    (t.total_income - t.total_expense)::bigint as net,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category_id', bc.id,
            'name', bc.name,
            'icon', bc.icon,
            'total', bc.total
          )
          order by bc.total desc, bc.name
        )
        from by_category bc
      ),
      '[]'::jsonb
    ) as categories
  from totals t, bounds b;
$function$;

CREATE OR REPLACE FUNCTION public.category_totals(p_from date, p_to date, p_kind category_kind)
 RETURNS TABLE(category_id uuid, name text, icon text, tint tint, total bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with bounds as (
    select * from public.local_day_range(p_from, p_to)
  )
  select
    c.id,
    c.name,
    c.icon,
    c.tint,
    sum(t.amount)::bigint as total
  from public.transactions t
  join public.categories c on c.id = t.category_id
  cross join bounds b
  where t.user_id = (select auth.uid())
    -- A transfer has no category and belongs to neither side of this split.
    and t.type = (p_kind::text)::public.transaction_type
    and t.occurred_at >= b.starts_at
    and t.occurred_at < b.ends_at
  group by c.id, c.name, c.icon, c.tint
  order by sum(t.amount) desc, c.name;
$function$;

comment on function public.category_totals(date, date, public.category_kind) is
  'Income or expense per category between two local dates, inclusive, biggest first.';
revoke all on function public.category_totals(date, date, public.category_kind)
  from public;
grant execute on function public.category_totals(date, date, public.category_kind)
  to authenticated;

CREATE OR REPLACE FUNCTION public.quick_adds()
 RETURNS TABLE(category_id uuid, name text, icon text, tint tint, amount bigint, account_id uuid, account_name text, used integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with recent as (
    select
      t.category_id,
      t.account_id,
      t.amount
    from public.transactions t
    where t.user_id = (select auth.uid())
      and t.type = 'expense'
      and t.category_id is not null
      and t.occurred_at >= now() - interval '60 days'
  ),
  habits as (
    select
      r.category_id,
      r.account_id,
      r.amount,
      count(*)::integer as used
    from recent r
    group by r.category_id, r.account_id, r.amount
    having count(*) >= 3
  )
  select
    h.category_id,
    c.name,
    c.icon,
    c.tint,
    h.amount,
    h.account_id,
    a.name as account_name,
    h.used
  from habits h
  join public.categories c on c.id = h.category_id and c.archived = false
  join public.accounts a on a.id = h.account_id and a.archived = false
  order by h.used desc, h.amount asc
  limit 6;
$function$;

comment on function public.quick_adds() is
  'The things this person buys over and over, as one-tap chips.';
revoke all on function public.quick_adds() from public;
grant execute on function public.quick_adds() to authenticated;

CREATE OR REPLACE FUNCTION public.default_categories()
 RETURNS TABLE(name text, kind category_kind, icon text, tint tint, sort_order integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select
    t.name::text,
    t.kind::public.category_kind,
    t.icon::text,
    t.tint::public.tint,
    t.sort_order::integer
  from (
    values
      ('Food',          'expense', 'UtensilsCrossed', 'rose',    0),
      ('Groceries',     'expense', 'ShoppingBasket',  'peach',   1),
      ('Transport',     'expense', 'Bus',             'sky',     2),
      ('Fuel',          'expense', 'Fuel',            'butter',  3),
      ('Shopping',      'expense', 'ShoppingBag',     'lilac',   4),
      ('Bills',         'expense', 'ReceiptText',     'butter',  5),
      ('Rent',          'expense', 'House',           'peri',    6),
      ('Health',        'expense', 'HeartPulse',      'mint',    7),
      ('Education',     'expense', 'GraduationCap',   'sky',     8),
      ('Entertainment', 'expense', 'Clapperboard',    'lilac',   9),
      ('Travel',        'expense', 'Plane',           'sky',    10),
      ('Gifts',         'expense', 'Gift',            'rose',   11),
      ('Others',        'expense', 'CircleEllipsis',  'neutral',12),
      ('Salary',        'income',  'Banknote',        'mint',    0),
      ('Business',      'income',  'Briefcase',       'butter',  1),
      ('Freelance',     'income',  'Laptop',          'sky',     2),
      ('Interest',      'income',  'PiggyBank',       'lilac',   3),
      ('Gifts',         'income',  'Gift',            'rose',    4),
      ('Others',        'income',  'CircleEllipsis',  'neutral', 5)
  ) as t (name, kind, icon, tint, sort_order);
$function$;

comment on function public.default_categories() is
  'The starter category set, with Phase 14 tints. Also used by seeds and tests.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.accounts (
    user_id, name, type, icon, tint, include_in_total, sort_order
  )
  values (new.id, 'Cash', 'cash', 'Wallet', 'mint', true, 0)
  on conflict do nothing;

  insert into public.categories (
    user_id, name, kind, icon, tint, sort_order
  )
  select new.id, d.name, d.kind, d.icon, d.tint, d.sort_order
  from public.default_categories() d
  on conflict do nothing;

  return new;
end;
$function$;
