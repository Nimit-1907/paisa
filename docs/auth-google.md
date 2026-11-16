# Turning on "Continue with Google"

The button is built and hidden. It appears once these steps are done.

## 1. Create the Google OAuth client

1. Google Cloud Console → APIs & Services → **OAuth consent screen**: app
   name "Paisa", your support email, scopes `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID**, type **Web
   application**.
3. **Authorised redirect URIs**, one per environment:
   - local: `http://127.0.0.1:54321/auth/v1/callback`
   - hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the client ID and secret.

## 2. Local

1. In `.env.local` (never committed):
   ```
   AUTH_GOOGLE=true
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<secret>
   ```
   The Supabase CLI reads the two `SUPABASE_AUTH_*` values from the
   environment, so export them in the shell that runs it (for example
   `set -a; source .env.local; set +a`).
2. In `supabase/config.toml`, set `enabled = true` under
   `[auth.external.google]`.
3. `supabase stop && supabase start`, then restart the app. `AUTH_GOOGLE`
   is server-only and read on every request, so no rebuild is needed.

## 3. Hosted

1. Supabase dashboard → Authentication → Providers → **Google**: enable,
   paste the client ID and secret.
2. Authentication → URL configuration: add `https://<your-site>/auth/callback`
   to the redirect URLs.
3. Set `AUTH_GOOGLE=true` in the host's environment and restart the app.

## How it works

`startGoogleSignIn` (src/actions/auth.ts) asks Supabase for the Google URL,
with `redirectTo` = `/auth/callback?next=…` (`oauthCallbackUrl`, which keeps
`next` on-site). The callback trades the code for a session, as it does for
email links. A first-time Google user gets a profile from the same
`handle_new_user` trigger, named from Google's `full_name`, and lands on
onboarding like any new account.
