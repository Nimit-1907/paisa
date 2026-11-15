-- Paisa: eight soft tints, in place of sixteen free colours.
--
-- Phase 14 replaces the colour picker with a fixed set of eight pastel keys.
-- A tint carries identity — "this row is Food" — and deliberately carries no
-- emphasis: every one of them takes plain ink text at 11:1 or better in both
-- themes, so a tile can never be the loudest thing on a screen.
--
-- Stored as a key rather than a hex value. The old `color` column held
-- whatever the palette happened to be that month, which is why Phase 12 had
-- to migrate every row by nearest-colour distance. A key survives a change of
-- shade: when the light-mode rose moves, nothing in the database has to.

-- The eight, as a domain so the check lives in one place.
create domain public.tint as text
  check (value in (
    'rose', 'peach', 'sky', 'butter', 'mint', 'lilac', 'peri', 'neutral'
  ));

comment on domain public.tint is
  'One of the eight Phase 14 soft tints. See src/lib/tokens.ts.';

alter table public.categories
  add column if not exists tint public.tint not null default 'neutral';

alter table public.accounts
  add column if not exists tint public.tint not null default 'neutral';

comment on column public.categories.tint is
  'Which soft tint the category tile carries.';
comment on column public.accounts.tint is
  'Which soft tint the account tile carries.';

/*
 * Existing rows, mapped by name.
 *
 * Not by colour. The old hexes were a curated-but-arbitrary sixteen, and
 * mapping them to eight pastels by distance would put Food and Fuel on the
 * same tint because their oranges were adjacent — while what people actually
 * remember is that Food is the pink one. The names are the meaning, so the
 * names are what is mapped; anything unrecognised gets neutral, which reads
 * as "not chosen" rather than as a wrong guess.
 */
update public.categories c
set tint = m.tint
from (
  values
    ('food', 'rose'), ('groceries', 'peach'), ('transport', 'sky'),
    ('fuel', 'butter'), ('shopping', 'lilac'), ('bills', 'butter'),
    ('rent', 'peri'), ('health', 'mint'), ('education', 'sky'),
    ('entertainment', 'lilac'), ('travel', 'sky'), ('gifts', 'rose'),
    ('others', 'neutral'),
    ('salary', 'mint'), ('business', 'butter'), ('freelance', 'sky'),
    ('interest', 'lilac')
) as m (name, tint)
where lower(btrim(c.name)) = m.name;

/*
 * Accounts take their tint from their type, which is the only thing about an
 * account that is reliably true. A "HDFC Savings" row is a savings account
 * whatever it is called.
 */
update public.accounts a
set tint = case a.type
  when 'cash' then 'mint'
  when 'bank' then 'sky'
  when 'card' then 'lilac'
  when 'savings' then 'peri'
  when 'wallet' then 'peach'
  else 'neutral'
end;

/*
 * The starter categories, now carrying tints.
 *
 * `color` stays in the signature and the table: dropping a column is the one
 * migration that cannot be undone by the next one, and an export written
 * before today still refers to it. The app stops reading it — see
 * src/lib/queries — and a later phase can drop it once nothing has for a
 * while.
 */
-- Dropped first: `create or replace` cannot change a function's return
-- type, and this one gains a `tint` column. `handle_new_user` calls it by
-- name and resolves that at runtime, so recreating it below is enough.
drop function if exists public.default_categories();

create function public.default_categories()
returns table (
  name text,
  kind public.category_kind,
  icon text,
  color text,
  tint public.tint,
  sort_order integer
)
language sql
immutable
set search_path = ''
as $$
  select
    t.name::text,
    t.kind::public.category_kind,
    t.icon::text,
    t.color::text,
    t.tint::public.tint,
    t.sort_order::integer
  from (
    values
      ('Food',          'expense', 'UtensilsCrossed', '#AA5830', 'rose',    0),
      ('Groceries',     'expense', 'ShoppingBasket',  '#3E8343', 'peach',   1),
      ('Transport',     'expense', 'Bus',             '#007DAA', 'sky',     2),
      ('Fuel',          'expense', 'Fuel',            '#AD5349', 'butter',  3),
      ('Shopping',      'expense', 'ShoppingBag',     '#A65175', 'lilac',   4),
      ('Bills',         'expense', 'ReceiptText',     '#7D5FAD', 'butter',  5),
      ('Rent',          'expense', 'House',           '#9D6300', 'peri',    6),
      ('Health',        'expense', 'HeartPulse',      '#008760', 'mint',    7),
      ('Education',     'expense', 'GraduationCap',   '#6568B6', 'sky',     8),
      ('Entertainment', 'expense', 'Clapperboard',    '#985593', 'lilac',   9),
      ('Travel',        'expense', 'Plane',           '#008781', 'sky',    10),
      ('Gifts',         'expense', 'Gift',            '#AC505B', 'rose',   11),
      ('Others',        'expense', 'CircleEllipsis',  '#69737D', 'neutral',12),
      ('Salary',        'income',  'Banknote',        '#627D23', 'mint',    0),
      ('Business',      'income',  'Briefcase',       '#8D6D00', 'butter',  1),
      ('Freelance',     'income',  'Laptop',          '#4671B7', 'sky',     2),
      ('Interest',      'income',  'PiggyBank',       '#008781', 'lilac',   3),
      ('Gifts',         'income',  'Gift',            '#A65175', 'rose',    4),
      ('Others',        'income',  'CircleEllipsis',  '#69737D', 'neutral', 5)
  ) as t (name, kind, icon, color, tint, sort_order);
$$;

comment on function public.default_categories() is
  'The starter category set, with Phase 14 tints. Also used by seeds and tests.';

-- The signup trigger, carrying the tint through for both the Cash account
-- and the starter categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.accounts (
    user_id, name, type, icon, color, tint, include_in_total, sort_order
  )
  values (new.id, 'Cash', 'cash', 'Wallet', '#008781', 'mint', true, 0)
  on conflict do nothing;

  insert into public.categories (
    user_id, name, kind, icon, color, tint, sort_order
  )
  select new.id, d.name, d.kind, d.icon, d.color, d.tint, d.sort_order
  from public.default_categories() d
  on conflict do nothing;

  return new;
end;
$$;

-- Readable and writable as itself, like the other user-owned columns.
grant select (tint) on public.categories to authenticated;
grant update (tint) on public.categories to authenticated;
grant insert (tint) on public.categories to authenticated;

grant select (tint) on public.accounts to authenticated;
grant update (tint) on public.accounts to authenticated;
grant insert (tint) on public.accounts to authenticated;
