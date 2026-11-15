-- Paisa: the totals behind a search, over every match rather than the page.
--
-- The search screen caps at a hundred rows, which is the right call for a
-- list — past that the term is not narrow enough. It is the wrong call for
-- the figure above the list: summing the hundred rows that came back and
-- calling it "what you have spent on rent" is wrong by however much is
-- behind the cap, and wrong in the direction that reassures.
--
-- So the rows are capped and the totals are not. This counts and sums in
-- the database over the whole match set, which is one index scan and no
-- rows on the wire.
--
-- `p_pattern` is already escaped by the caller — the same escaping the row
-- query uses, done once in src/lib/queries/transactions.ts, so the two can
-- never disagree about what a literal `%` means. It is a bound parameter,
-- not interpolated SQL.

create function public.search_totals(p_pattern text)
returns table (
  match_count integer,
  income bigint,
  expense bigint
)
language sql
stable
set search_path = ''
as $$
  select
    count(*)::integer as match_count,
    coalesce(
      sum(t.amount) filter (where t.type = 'income'), 0
    )::bigint as income,
    coalesce(
      sum(t.amount) filter (where t.type = 'expense'), 0
    )::bigint as expense
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.note ilike '%' || p_pattern || '%';
$$;

comment on function public.search_totals(text) is
  'How many records match a note search, and what they come to, over every match.';

revoke all on function public.search_totals(text) from public;
grant execute on function public.search_totals(text) to authenticated;
