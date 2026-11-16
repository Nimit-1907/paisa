-- Paisa: a signed-out session is refused even with a validly signed token.
--
--     supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'b8888888-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'sessions@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values ('b8000000-0000-4000-8000-0000000000a1',
        'b8888888-0000-4000-8000-000000000001', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated","session_id":"b8000000-0000-4000-8000-0000000000a1"}';

select ok(public.session_is_active(), 'a live session is active');

set local request.jwt.claims = '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated","session_id":"b8000000-0000-4000-8000-0000000000ff"}';

select ok(not public.session_is_active(), 'an unknown session is not');

set local request.jwt.claims = '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(not public.session_is_active(), 'a token with no session is not');

reset role;
delete from auth.sessions where id = 'b8000000-0000-4000-8000-0000000000a1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b8888888-0000-4000-8000-000000000001","role":"authenticated","session_id":"b8000000-0000-4000-8000-0000000000a1"}';

select ok(not public.session_is_active(), 'a signed-out session is not');

select * from finish();
rollback;
