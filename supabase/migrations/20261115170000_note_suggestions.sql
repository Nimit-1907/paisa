-- Paisa: the notes this person has written before.
--
-- Notes repeat far more than people expect — "DMart run", "Chai and vada pav",
-- "Metro card top-up" — and retyping one on a phone keyboard is most of the
-- effort of logging the record. Offering them back is the cheapest speed-up
-- available on the Add Record sheet.
--
-- An aggregate over months of rows, so it belongs here rather than in the
-- client: shipping every note to the browser to count them would be slower,
-- heavier, and a worse answer than Postgres gives for free.

/*
 * The notes worth offering, most useful first.
 *
 * Ordered by how often a note has been used and then by how recently, so a
 * weekly habit beats a one-off from yesterday but yesterday still beats last
 * March. Deduplicated case-insensitively, keeping the spelling of the most
 * recent one: somebody who switched from "swiggy" to "Swiggy" meant the
 * second.
 *
 * Only the last year, because a note from eighteen months ago is a different
 * life, and only notes with something in them.
 */
create or replace function public.note_suggestions(p_limit integer default 50)
returns table (note text, used integer)
language sql
stable
set search_path = ''
as $$
  with recent as (
    select
      btrim(t.note) as note,
      t.occurred_at
    from public.transactions t
    where t.user_id = (select auth.uid())
      and t.note is not null
      and btrim(t.note) <> ''
      and t.occurred_at >= now() - interval '365 days'
  ),
  grouped as (
    select
      lower(r.note) as key,
      count(*)::integer as used,
      max(r.occurred_at) as last_used,
      -- The spelling of the most recent one, not an arbitrary row's.
      (array_agg(r.note order by r.occurred_at desc))[1] as note
    from recent r
    group by lower(r.note)
  )
  select g.note, g.used
  from grouped g
  order by g.used desc, g.last_used desc
  -- Clamped: this feeds a datalist, and a client asking for a million rows
  -- should get fifty.
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

comment on function public.note_suggestions(integer) is
  'Distinct notes from the last year, most-used first, for the Add Record sheet.';

-- Callable by a signed-in user only. The body filters on auth.uid(), and the
-- function is not SECURITY DEFINER, so row level security applies on top.
revoke all on function public.note_suggestions(integer) from public;
grant execute on function public.note_suggestions(integer) to authenticated;
