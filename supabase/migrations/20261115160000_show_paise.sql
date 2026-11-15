-- Paisa: "Show paise in lists".
--
-- Off by default. In a list of forty rows, ".00" is eighty characters of zero
-- repeated down the right-hand edge, and it pushes the digits that differ out
-- of alignment with the eye. Trimming it never changes a value - a row that
-- really is 450.50 still shows the 50 - so the only thing the setting decides
-- is whether two zeros are drawn.
--
-- A preference rather than something derived from decimal_places, because a
-- currency having paise does not mean this person wants to read them: the
-- people who do are the ones splitting bills to the rupee, and they are the
-- ones who will come and turn it on.
alter table public.profiles
  add column if not exists show_paise boolean not null default false;

comment on column public.profiles.show_paise is
  'Draw ".00" in lists and summaries. Real paise are always drawn.';

-- Readable with the rest of the profile, writable only as itself, like the
-- other preferences: the column grant is what keeps a client update from
-- reaching a column it has no business in.
grant select (show_paise) on public.profiles to authenticated;
grant update (show_paise) on public.profiles to authenticated;
