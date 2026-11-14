-- Paisa: letting someone delete their own account.
--
-- Deleting the auth.users row is what removes everything: profiles, accounts,
-- categories, transactions, budgets and recurring rules all reference it with
-- ON DELETE CASCADE, and the foreign keys between them are DEFERRABLE
-- INITIALLY DEFERRED precisely so the whole lot can go in one statement
-- without tripping over the order the cascades run in.
--
-- SECURITY DEFINER rather than a service-role key in the app's environment.
-- The key would let the server do anything to anyone; this function can only
-- ever delete the row belonging to whoever called it, and that is the entire
-- privilege it needs. It takes no arguments for the same reason — there is no
-- id to get wrong.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'delete_own_account() needs an authenticated user'
      using errcode = '42501';
  end if;

  delete from auth.users u where u.id = v_user;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user and, by cascade, everything they own. Cannot touch anyone else.';

-- Only a signed-in caller, and never anon: an anonymous call has no auth.uid()
-- and would raise, but saying so in the grants is clearer than relying on it.
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
