# Paisa — mobile-first expense tracker

Log income, expenses and transfers across accounts, set monthly category
budgets and see where the money goes. Phones first (designed at 360px), clean
on tablet and desktop.

Stack: Next.js 15 (App Router, TS strict) · Supabase (local, via the CLI) ·
Tailwind v4 + shadcn/ui · vaul · recharts · react-hook-form + zod · date-fns ·
next-themes · Serwist (PWA) · sonner · @react-pdf/renderer.

The conventions this project must follow live in [CLAUDE.md](./CLAUDE.md).

---

## Requirements

| Tool | Version |
| --- | --- |
| Node | **>= 20.19** (see `.nvmrc` — `nvm use`). Tailwind v4's toolchain uses `require(esm)`, which older 20.x builds do not support, and the build fails with `ERR_REQUIRE_ESM`. |
| Supabase CLI | >= 2.26 (`supabase --version`) |
| Docker | running — the local Supabase stack needs it |

## Getting started

```bash
nvm use                 # Node 22
npm install
cp .env.example .env.local   # already present for local dev

supabase start          # first run pulls the Postgres/Auth/Storage images
npm run dev             # http://localhost:3000 → /records
```

`supabase db reset` applies every migration in `supabase/migrations` and then
loads `supabase/seed.sql`, which creates a demo account with about three
months of data:

```
demo@example.com / password123
```

`supabase start` prints the local credentials:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOi...
```

Those two values are what `.env.local` holds (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). They are the CLI's defaults — identical on
every machine, valid only against 127.0.0.1, and not secrets. Stop the stack with `supabase stop` (add `--no-backup` to wipe the volume).

### Email goes to Mailpit, not to an inbox

Nothing is actually sent while developing. Every confirmation and
password-reset mail the app triggers is caught by the local mail server that
ships with the Supabase CLI — Mailpit, which the CLI still calls Inbucket:

```
http://127.0.0.1:54324
```

Sign up, open that page, click the link in the message. Confirmations are on
locally (`auth.email.enable_confirmations` in `supabase/config.toml`) so the
signup flow is the same one production will run.

### Port 54321 already in use

The CLI gives every project the same default ports, so a second Supabase stack
on the machine fails with `port is already allocated`. Either stop the other
project:

```bash
supabase stop --project-id <other-project>
```

…or give Paisa its own ports in `supabase/config.toml` (`api.port`, `db.port`,
`studio.port`, `inbucket.port`, `analytics.port`) and update
`NEXT_PUBLIC_SUPABASE_URL` to match.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` / `npm start` | Production build / serve (also builds the service worker) |
| `npm test` | Vitest (money helpers) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `npm run db:test` | pgTAP tests for RLS and the schema constraints |
| `npm run db:types` | Regenerate `src/types/database.ts` — run after **every** migration |

## Project layout

```
src/
  actions/            Server Actions: auth.ts, profile.ts
  app/
    (app)/            records, analysis, budgets, accounts, more,
                      categories, settings  — share the app shell layout
    (auth)/           login, signup, forgot-password, reset-password
    auth/callback/    exchanges the emailed code for a session
    onboarding/       first-run setup, its own full-screen layout
    layout.tsx        Inter, viewport (viewport-fit=cover), theme, toasts
    manifest.ts       PWA manifest (/manifest.webmanifest)
    sw.ts             Serwist service worker (built to /public/sw.js)
  components/
    accounts/         accounts screen + the add/edit sheet
    auth/             the four forms + sign-out button
    categories/       categories screen + the add/edit sheet
    layout/           app shell: bottom nav, sidebar, sticky page header
    onboarding/       the three-step flow
    records/          FAB + Add Record sheet
    shared/           sheet, icon picker, colour picker, sortable list
    profile-provider  currency context for Client Components
    ui/               shadcn primitives
  hooks/              use-media-query
  lib/
    currencies.ts     the pickable currency list
    dates.ts          month ranges in the user's timezone (+ tests)
    icons.ts          the lucide subset the pickers offer
    queries/          read helpers for Server Components
    money.ts          minor-unit parsing/formatting (+ money.test.ts)
    nav.ts            the five tabs, in one place
    profile.ts        cached getProfile() for Server Components
    routes.ts         which paths are app / auth / neutral
    schemas/          zod schemas shared by forms and actions
    supabase/         server.ts, client.ts, middleware.ts, env.ts
  middleware.ts       refreshes the session and guards the route groups
supabase/
  migrations/         SQL migrations (never change the DB by hand)
  seed.sql            demo user + ~3 months of sample records
  tests/              pgTAP: rls.test.sql, schema.test.sql
scripts/
  generate-icons.py   regenerates the PWA icon set
```

## Conventions worth knowing

**Money is never a float.** Amounts are BIGINT minor units (paise) end to end.
`src/lib/money.ts` parses user input (`toMinor`) and formats at the very edge
(`formatMoney`, Indian 2-2-3 grouping for ₹). Covered by `npm test`.

**Mobile first.** 360px is the design width. Bottom tab bar + FAB on phones,
left sidebar from `lg` up with the content capped at 768px. Safe-area insets
are respected via the `pt-safe` / `pb-safe` / `pb-nav` utilities in
`globals.css`. Tap targets use the `touch` / `icon-touch` button sizes (44px).

**Archive, do not delete.** An account or category that anything points at
can only be archived: it keeps showing on the records that use it, and
disappears from the pickers that offer new ones. Delete is offered only when
`account_usage` / `category_usage` report nothing referencing it, and the
Server Action checks again before it runs.

**Reordering** is hand-rolled on Pointer Events (`components/shared/sortable-list`)
rather than a drag-and-drop library, which CLAUDE.md's stack does not include.
The handle is also a keyboard control — arrow keys move an item a slot — so
reordering never requires a pointer.

**Theme.** `next-themes` with light/dark/system. Colours are CSS variables in
`globals.css`; `--income` (green), `--expense` (rose) and `--transfer` (blue)
carry the money semantics and clear WCAG AA in both themes.

## Auth and onboarding

Email and password through Supabase Auth. Every mutation is a Server Action in
`src/actions`, validated with zod and returning
`{ ok: true, data } | { ok: false, error }` — never a thrown error, which
reaches the browser as an opaque digest. The forms show the message in a
toast and, when the failure belongs to one field, under that field.

The flow a new account goes through:

```
/signup → confirmation mail (Mailpit) → /auth/callback → /onboarding → /records
```

`/auth/callback` handles both shapes Supabase sends — `?code=` (PKCE) and
`?token_hash=&type=` — and sends failures to `/login?error=…` rather than
leaving the user on a blank page.

Middleware refreshes the session on every navigation and does the routing:
no session on an app route goes to `/login?next=…`, and a session on
`/login`, `/signup` or `/forgot-password` goes to `/records`.
`/reset-password` is exempt — the recovery link signs the user in before they
can choose a new password, so bouncing a session off that page would make
reset impossible.

Onboarding runs exactly once, gated on `profiles.display_name` being null:
name, then currency (searchable, sets symbol and decimal places), then the
opening balance of the Cash account signup created. The signup trigger
deliberately leaves `display_name` null even when the form sent a name, since
that column is the flag; the name is kept in user metadata and pre-fills
step 1.

Currency reaches the UI two ways: `getProfile()` (React `cache()`, one query
per request) for Server Components, and `ProfileProvider` / `useFormatMoney()`
for Client Components, so an amount is never rendered with somebody else's
symbol.

## The database

Six tables, all with `user_id` (profiles keys on `id = auth.users.id`), all
with row level security, all with an `updated_at` trigger:

| Table | Holds |
| --- | --- |
| `profiles` | currency, decimal places, week start, theme, timezone |
| `accounts` | cash / bank / card / savings / wallet, opening balance, archive flag |
| `categories` | income or expense, lucide icon, colour, unique per kind per user |
| `transactions` | income / expense / transfer in minor units, with note and timestamp |
| `budgets` | one amount per expense category per month |
| `recurring_rules` | a transaction template plus a schedule |

Rules the database enforces, so the UI cannot get them wrong:

- A transfer needs a destination account, no category, and two different
  accounts. An income or expense needs a category and no destination.
- An income row must carry an income category, an expense row an expense one.
- A budget's `month` is always the first of the month, and only expense
  categories can have one.
- Every account / category / rule a row points at must belong to the same
  user — checked by trigger, because row level security governs which rows you
  may touch, not which ids you may write into a column.

Read models and RPCs:

- `account_balances` — a `security_invoker` view: opening balance + income −
  expense − transfers out + transfers in, per account.
- `month_summary(p_month date)` — income, expense, net and per-category expense
  totals for that month, evaluated in the profile's timezone so a late-evening
  IST purchase on the 31st stays in its own month.
- `process_due_recurring()` — creates every transaction the caller's active
  rules owe up to today (catching up whatever was missed while the app was
  closed), advances `next_run_on`, and switches a rule off once it passes its
  end date. Calling it twice in a day changes nothing the second time.

`npm run db:test` runs both pgTAP files: `rls.test.sql` puts two real
`authenticated` sessions side by side and checks that neither can read, write
or delete the other's rows, and `schema.test.sql` covers the constraints above.

After any migration, regenerate the types — `npm run db:types` — and never
edit `src/types/database.ts` by hand.

## Status

Phases 1–4 are done: the app shell, the database, auth with onboarding, and
managing accounts and categories. A new account can sign up, confirm by
email, pick a currency, set an opening balance and land on Records; accounts
and categories can be created, edited, reordered, archived and deleted, and
every balance comes from the `account_balances` view.

Next: the real Add Record form and the Records list.
