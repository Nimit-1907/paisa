-- A record's type is fixed once it is saved.
--
-- Turning an expense into a transfer is not an edit: it changes which
-- balances it moved, what its category means and whether it has a second
-- account at all. The edit sheet no longer offers it and the action no
-- longer sends it; this makes the database refuse it too, so no other path
-- (a script, a future action) can. Delete it and add the right one instead.

create or replace function public.transactions_type_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'a record''s type cannot be changed (was %, asked for %)',
      old.type, new.type
      using errcode = '22023';
  end if;
  return new;
end;
$$;

comment on function public.transactions_type_fixed() is
  'Refuses an update that changes transactions.type.';

create trigger transactions_type_fixed
  before update of type on public.transactions
  for each row execute function public.transactions_type_fixed();
