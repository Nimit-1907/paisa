-- Whether the session behind the caller's token still exists.
--
-- Pages verify the session token's signature locally rather than asking
-- the Auth server (src/lib/supabase/verify.ts). A signature cannot say the
-- session was signed out on another device, or that its user was deleted:
-- both remove the row from auth.sessions, and this asks that table. One
-- indexed lookup through PostgREST, which answers in parallel, where the
-- Auth server's /user queued.

create or replace function public.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.sessions s
     where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and s.user_id = auth.uid()
       and (s.not_after is null or s.not_after > now())
  );
$$;

comment on function public.session_is_active() is
  'True while the session in the caller''s JWT exists and has not lapsed.';

revoke execute on function public.session_is_active() from public, anon;
grant execute on function public.session_is_active() to authenticated;
