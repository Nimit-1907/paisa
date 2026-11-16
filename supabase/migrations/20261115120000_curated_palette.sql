-- Paisa: move every stored colour onto the curated palette.
--
-- The sixteen swatches were Tailwind-ish mid tones picked one at a time, so
-- they disagreed about lightness and saturation: a list of categories read as
-- a set of warnings rather than a set of labels. The new sixteen share one
-- lightness and one chroma, which is what makes them look chosen rather than
-- collected.
--
-- Old values are mapped by position, not by distance. The two lists are in
-- the same hue order, so amber stays amber and gold stays gold, nearest
-- colour would have collapsed that pair onto one swatch and quietly made two
-- of somebody's categories identical.
create temporary table palette_map (old text primary key, new text) on commit drop;

insert into palette_map (old, new) values
  ('#0F766E', '#008781'),  -- teal
  ('#0EA5E9', '#007DAA'),  -- sky
  ('#2563EB', '#4671B7'),  -- blue
  ('#6366F1', '#6568B6'),  -- indigo
  ('#7C3AED', '#7D5FAD'),  -- violet
  ('#D946EF', '#985593'),  -- fuchsia
  ('#EC4899', '#A65175'),  -- pink
  ('#F43F5E', '#AC505B'),  -- rose
  ('#EF4444', '#AD5349'),  -- red
  ('#F97316', '#AA5830'),  -- orange
  ('#F59E0B', '#9D6300'),  -- amber
  ('#CA8A04', '#8D6D00'),  -- gold
  ('#65A30D', '#627D23'),  -- lime
  ('#22C55E', '#3E8343'),  -- green
  ('#14B8A6', '#008760'),  -- emerald
  ('#64748B', '#69737D');  -- slate

-- Anything that is not one of the old sixteen, written through the API, or
-- left over from an older build, goes to the nearest new swatch, compared in
-- linear light rather than on the hex digits.
create temporary table palette_new (hex text primary key) on commit drop;
insert into palette_new (hex) select new from palette_map;

create or replace function pg_temp.linear(channel double precision)
returns double precision
language sql
immutable
as $$
  select case
    when channel <= 0.04045 then channel / 12.92
    else power((channel + 0.055) / 1.055, 2.4)
  end;
$$;

create or replace function pg_temp.distance(a text, b text)
returns double precision
language sql
immutable
as $$
  select
    power(pg_temp.linear(('x' || substr(a, 2, 2))::bit(8)::int / 255.0)
        - pg_temp.linear(('x' || substr(b, 2, 2))::bit(8)::int / 255.0), 2)
  + power(pg_temp.linear(('x' || substr(a, 4, 2))::bit(8)::int / 255.0)
        - pg_temp.linear(('x' || substr(b, 4, 2))::bit(8)::int / 255.0), 2)
  + power(pg_temp.linear(('x' || substr(a, 6, 2))::bit(8)::int / 255.0)
        - pg_temp.linear(('x' || substr(b, 6, 2))::bit(8)::int / 255.0), 2);
$$;

/*
 * Both tables, both columns, every user's rows.
 *
 * No user_id filter and no RLS consideration: a migration runs as the owner
 * and this is a change to how a colour looks, not to whose it is.
 */
update public.categories c
set color = coalesce(
  (select m.new from palette_map m where upper(m.old) = upper(c.color)),
  (select p.hex from palette_new p
    order by pg_temp.distance(upper(p.hex), upper(c.color)) limit 1)
)
where c.color is not null
  and c.color !~* '^(#008781|#007DAA|#4671B7|#6568B6|#7D5FAD|#985593|#A65175|#AC505B|#AD5349|#AA5830|#9D6300|#8D6D00|#627D23|#3E8343|#008760|#69737D)$';

update public.accounts a
set color = coalesce(
  (select m.new from palette_map m where upper(m.old) = upper(a.color)),
  (select p.hex from palette_new p
    order by pg_temp.distance(upper(p.hex), upper(a.color)) limit 1)
)
where a.color is not null
  and a.color !~* '^(#008781|#007DAA|#4671B7|#6568B6|#7D5FAD|#985593|#A65175|#AC505B|#AD5349|#AA5830|#9D6300|#8D6D00|#627D23|#3E8343|#008760|#69737D)$';

/*
 * And the starter set every new account is created with.
 *
 * Without this the migration would be a one-off: existing categories would
 * move to the palette and the next person to sign up would get the old
 * sixteen back. Same names, same icons, same order, only the colours move,
 * each to its own swatch within its kind.
 */
create or replace function public.default_categories()
returns table (
  name text,
  kind public.category_kind,
  icon text,
  color text,
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
    t.sort_order::integer
  from (
    values
      ('Food',          'expense', 'UtensilsCrossed', '#AA5830',  0),
      ('Groceries',     'expense', 'ShoppingBasket',  '#3E8343',  1),
      ('Transport',     'expense', 'Bus',             '#007DAA',  2),
      ('Fuel',          'expense', 'Fuel',            '#AD5349',  3),
      ('Shopping',      'expense', 'ShoppingBag',     '#A65175',  4),
      ('Bills',         'expense', 'ReceiptText',     '#7D5FAD',  5),
      ('Rent',          'expense', 'House',           '#9D6300',  6),
      ('Health',        'expense', 'HeartPulse',      '#008760',  7),
      ('Education',     'expense', 'GraduationCap',   '#6568B6',  8),
      ('Entertainment', 'expense', 'Clapperboard',    '#985593',  9),
      ('Travel',        'expense', 'Plane',           '#008781', 10),
      ('Gifts',         'expense', 'Gift',            '#AC505B', 11),
      ('Others',        'expense', 'CircleEllipsis',  '#69737D', 12),
      ('Salary',        'income',  'Banknote',        '#627D23',  0),
      ('Business',      'income',  'Briefcase',       '#8D6D00',  1),
      ('Freelance',     'income',  'Laptop',          '#4671B7',  2),
      ('Interest',      'income',  'PiggyBank',       '#008781',  3),
      ('Gifts',         'income',  'Gift',            '#A65175',  4),
      ('Others',        'income',  'CircleEllipsis',  '#69737D',  5)
  ) as t (name, kind, icon, color, sort_order);
$$;

comment on function public.default_categories() is
  'The starter category set, on the curated palette. Also used by seeds and tests.';

/*
 * The Cash account the signup trigger creates, too.
 *
 * Same reason as the categories above: without it the first account of every
 * new user arrives in the old teal. The body is unchanged apart from that one
 * value, see 20261114130000_onboarding_marker.sql for why display_name stays
 * null here.
 */
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
    user_id, name, type, icon, color, include_in_total, sort_order
  )
  values (new.id, 'Cash', 'cash', 'Wallet', '#008781', true, 0)
  on conflict do nothing;

  insert into public.categories (
    user_id, name, kind, icon, color, sort_order
  )
  select new.id, d.name, d.kind, d.icon, d.color, d.sort_order
  from public.default_categories() d
  on conflict do nothing;

  return new;
end;
$$;
