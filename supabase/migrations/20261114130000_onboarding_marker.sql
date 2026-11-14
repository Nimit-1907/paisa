-- Paisa: leave display_name for onboarding to fill in.
--
-- profiles.display_name doubles as the "has this user been through first-run
-- setup?" flag. The original trigger copied a name out of the signup form's
-- metadata, which set the flag before onboarding had run — so anyone who
-- typed their name at signup never got asked for a currency or an opening
-- balance, and landed on an app configured entirely by defaults.
--
-- The metadata is still kept: the onboarding screen reads it to pre-fill the
-- name field, so nobody types it twice.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- display_name stays null on purpose: completeOnboarding() writes it, and
  -- that write is what marks setup as done.
  insert into public.profiles (id)
  values (new.id)
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
  'Seeds a new auth user with a profile, a Cash account and default categories. display_name is left null so onboarding runs once.';
