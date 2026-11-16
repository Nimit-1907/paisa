-- Paisa: core schema.
--
-- Money is BIGINT minor units (paise) everywhere, never numeric, never float.
-- Every table carries user_id (profiles carries id = auth.users.id instead) and
-- gets row level security in the next migration.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- enums ----

create type public.account_type as enum (
  'cash',
  'bank',
  'card',
  'savings',
  'wallet',
  'other'
);

create type public.category_kind as enum ('income', 'expense');

create type public.transaction_type as enum ('income', 'expense', 'transfer');

create type public.recurrence_frequency as enum (
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

-- ------------------------------------------------------------- profiles ----

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  currency_code text not null default 'INR'
    check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol text not null default '₹'
    check (char_length(currency_symbol) between 1 and 4),
  decimal_places smallint not null default 2
    check (decimal_places between 0 and 3),
  -- 0 = Sunday … 6 = Saturday, matching date-fns' weekStartsOn.
  week_start smallint not null default 1 check (week_start between 0 and 6),
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  -- Month boundaries and "today" are evaluated here, not in UTC: an IST
  -- evening belongs to the day the user thinks it does.
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user settings. One row per auth.users row, created by the signup trigger.';

-- ------------------------------------------------------------- accounts ----

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type public.account_type not null default 'cash',
  icon text check (char_length(icon) <= 40),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  initial_balance bigint not null default 0,
  include_in_total boolean not null default true,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_order_idx
  on public.accounts (user_id, archived, sort_order, created_at);

comment on column public.accounts.initial_balance is
  'Opening balance in minor units; the balance view adds movements to it.';

-- ----------------------------------------------------------- categories ----

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.category_kind not null,
  icon text check (char_length(icon) <= 40),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Gifts" may exist once as income and once as expense, but not twice as
-- either, and "food" must not sneak in beside "Food".
create unique index categories_user_kind_name_key
  on public.categories (user_id, kind, lower(btrim(name)));

create index categories_user_order_idx
  on public.categories (user_id, kind, archived, sort_order);

-- ------------------------------------------------------ recurring rules ----

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Template for the transactions this rule creates.
  type public.transaction_type not null,
  amount bigint not null check (amount > 0),
  account_id uuid not null references public.accounts (id)
    on delete no action deferrable initially deferred,
  to_account_id uuid references public.accounts (id)
    on delete no action deferrable initially deferred,
  category_id uuid references public.categories (id)
    on delete no action deferrable initially deferred,
  note text check (char_length(note) <= 500),

  frequency public.recurrence_frequency not null,
  -- Named interval_count because INTERVAL is a reserved word in Postgres and a
  -- column called "interval" needs quoting everywhere it is touched.
  interval_count integer not null default 1
    check (interval_count between 1 and 365),
  start_date date not null default current_date,
  end_date date,
  next_run_on date not null,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_rules_dates_check
    check (end_date is null or end_date >= start_date),
  constraint recurring_rules_shape_check check (
    case type
      when 'transfer' then
        to_account_id is not null
        and category_id is null
        and to_account_id <> account_id
      else
        category_id is not null
        and to_account_id is null
    end
  )
);

create index recurring_rules_due_idx
  on public.recurring_rules (user_id, next_run_on)
  where active;

-- --------------------------------------------------------- transactions ----

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount bigint not null check (amount > 0),

  -- NO ACTION DEFERRABLE rather than RESTRICT: deleting an account that still
  -- has transactions must fail, but deleting the *user* cascades both away in
  -- one transaction and must not trip over the order the cascades run in.
  account_id uuid not null references public.accounts (id)
    on delete no action deferrable initially deferred,
  to_account_id uuid references public.accounts (id)
    on delete no action deferrable initially deferred,
  category_id uuid references public.categories (id)
    on delete no action deferrable initially deferred,

  note text check (char_length(note) <= 500),
  occurred_at timestamptz not null default now(),
  recurring_rule_id uuid references public.recurring_rules (id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_shape_check check (
    case type
      when 'transfer' then
        to_account_id is not null
        and category_id is null
        and to_account_id <> account_id
      else
        category_id is not null
        and to_account_id is null
    end
  )
);

-- The record list: one user's month, newest first.
create index transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);

create index transactions_user_category_idx
  on public.transactions (user_id, category_id);

create index transactions_user_account_idx
  on public.transactions (user_id, account_id);

-- Transfers land on the destination account too, and the balance view joins
-- on it.
create index transactions_user_to_account_idx
  on public.transactions (user_id, to_account_id)
  where to_account_id is not null;

-- Deleting a rule nulls this column on every row that references it; without
-- an index that is a scan of every user's transactions.
create index transactions_recurring_rule_idx
  on public.transactions (recurring_rule_id)
  where recurring_rule_id is not null;

-- Note search ("swiggy", "petrol") via ILIKE/%similarity%.
create index transactions_note_trgm_idx
  on public.transactions using gin (note extensions.gin_trgm_ops);

-- -------------------------------------------------------------- budgets ----

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Budgets are per expense category; the kind is enforced by trigger, which a
  -- CHECK cannot do because it may not read another table.
  category_id uuid not null references public.categories (id) on delete cascade
    deferrable initially deferred,
  month date not null
    check (month = date_trunc('month', month::timestamp)::date),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_user_category_month_key unique (user_id, category_id, month)
);

create index budgets_user_month_idx on public.budgets (user_id, month);

comment on column public.budgets.month is
  'Always the first of the month; the CHECK rejects any other day.';
