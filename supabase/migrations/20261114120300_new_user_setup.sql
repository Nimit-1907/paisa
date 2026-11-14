-- Paisa: what a brand new account starts with.
--
-- A signup gets a profile, a "Cash" account and a usable set of categories, so
-- the first screen after sign-up is never an empty form asking the user to
-- invent taxonomy before they can log a chai.

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
  -- Icons are lucide-react component names; colours are the category chips.
  select
    t.name::text,
    t.kind::public.category_kind,
    t.icon::text,
    t.color::text,
    t.sort_order::integer
  from (
    values
      ('Food',          'expense', 'UtensilsCrossed', '#F97316',  0),
      ('Groceries',     'expense', 'ShoppingBasket',  '#22C55E',  1),
      ('Transport',     'expense', 'Bus',             '#0EA5E9',  2),
      ('Fuel',          'expense', 'Fuel',            '#EF4444',  3),
      ('Shopping',      'expense', 'ShoppingBag',     '#EC4899',  4),
      ('Bills',         'expense', 'ReceiptText',     '#8B5CF6',  5),
      ('Rent',          'expense', 'House',           '#F59E0B',  6),
      ('Health',        'expense', 'HeartPulse',      '#14B8A6',  7),
      ('Education',     'expense', 'GraduationCap',   '#6366F1',  8),
      ('Entertainment', 'expense', 'Clapperboard',    '#D946EF',  9),
      ('Travel',        'expense', 'Plane',           '#06B6D4', 10),
      ('Gifts',         'expense', 'Gift',            '#F43F5E', 11),
      ('Others',        'expense', 'CircleEllipsis',  '#64748B', 12),
      ('Salary',        'income',  'Banknote',        '#16A34A',  0),
      ('Business',      'income',  'Briefcase',       '#0D9488',  1),
      ('Freelance',     'income',  'Laptop',          '#2563EB',  2),
      ('Interest',      'income',  'PiggyBank',       '#7C3AED',  3),
      ('Gifts',         'income',  'Gift',            '#DB2777',  4),
      ('Others',        'income',  'CircleEllipsis',  '#475569',  5)
  ) as t (name, kind, icon, color, sort_order);
$$;

comment on function public.default_categories() is
  'The starter category set. Also used by seeds and tests.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )), '')
  )
  on conflict (id) do nothing;

  insert into public.accounts (
    user_id, name, type, icon, color, include_in_total, sort_order
  )
  values (new.id, 'Cash', 'cash', 'Wallet', '#0F766E', true, 0)
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

comment on function public.handle_new_user() is
  'Seeds a new auth user with a profile, a Cash account and default categories.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
