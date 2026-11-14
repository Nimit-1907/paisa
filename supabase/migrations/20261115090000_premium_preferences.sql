-- Paisa: the three things the interface needs to remember about a person.
--
-- All of them are preferences, not data: whether the phone should buzz, which
-- month's recap has been seen, and whether the "first record" note has been
-- shown. They live on the profile rather than in the browser because a
-- one-time message that reappears on a second device is not one-time, and a
-- setting that resets when the cache is cleared is not a setting.
alter table public.profiles
  add column if not exists haptics boolean not null default true,
  add column if not exists recap_seen_for date,
  add column if not exists first_record_seen boolean not null default false;

comment on column public.profiles.haptics is
  'Light vibration on save and delete, where the device supports it.';
comment on column public.profiles.recap_seen_for is
  'First day of the month whose recap card has been dismissed.';
comment on column public.profiles.first_record_seen is
  'True once the "your first record is in" note has been shown.';

-- Readable like the rest of the profile, writable only as themselves: the
-- column grants are what stop a client update from reaching, say, the
-- password attempt counter in the same statement.
grant select (haptics, recap_seen_for, first_record_seen)
  on public.profiles to authenticated;
grant update (haptics, recap_seen_for, first_record_seen)
  on public.profiles to authenticated;
