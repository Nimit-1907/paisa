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
| `npm test` | Vitest: money, dates, recurrence, periods, the keypad calculator, the zod schemas, routes, icons |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright, on a 390×844 phone — the whole journey plus the accessibility sweep |
| `npm run test:e2e:ui` | The same, in Playwright's UI mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `npm run db:test` | pgTAP: RLS, schema constraints, recurrence, budgets, analysis, account deletion |
| `npm run db:types` | Regenerate `src/types/database.ts` — run after **every** migration |

## Project layout

```
src/
  actions/            Server Actions: auth, profile, accounts,
                      categories, transactions, recurring, budgets
  app/
    (app)/            records, analysis, budgets, accounts, more, about,
                      categories, recurring, settings, export — the shell
    api/export/       csv (streamed) and pdf (@react-pdf/renderer)
    offline/          what the service worker serves with no network
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
    analysis/         the period selector and the three charts
    budgets/          the month card, the rows, the budget sheet
    pwa/              install prompt and the update toast
    records/          the month list, the record sheet, the keypad,
                      the filter sheet, the upcoming strip, the FAB
    recurring/        the rules list, the rule sheet, delete choices
    settings/         the settings form, password, delete, export
    shared/           sheet, icon picker, colour picker, sortable list
    profile-provider  currency context for Client Components
    ui/               shadcn primitives
  hooks/              use-media-query
  lib/
    auth-guard.ts     requireUser() for every Server Action
    calculator.ts     the keypad's arithmetic, no eval (+ tests)
    currencies.ts     the pickable currency list
    dates.ts          month ranges in the user's timezone (+ tests)
    icons.ts          the lucide subset the pickers offer
    queries/          read helpers for Server Components
    money.ts          minor-unit parsing/formatting (+ money.test.ts)
    month-param.ts    reads ?m= and the filters off a URL
    nav.ts            the five tabs, in one place
    period.ts         week/month/year/range maths (+ tests)
    profile.ts        cached getProfile() for Server Components
    recurrence.ts     the schedule calendar, mirroring SQL (+ tests)
    recurring-check.ts  runs the catch-up once a day
    recurring-rule.ts   a rule as the screens see it
    relative-day.ts   "tomorrow", "in 3 days", "Sat 21 Nov"
    routes.ts         which paths are app / auth / neutral
    schemas/          zod schemas shared by forms and actions
    supabase/         server.ts, client.ts, middleware.ts, env.ts
  middleware.ts       refreshes the session and guards the route groups
e2e/
  journey.spec.ts     signup → onboarding → records → budget →
                      recurring → analysis → export, on a phone
  polish.spec.ts      axe, overflow, tap targets and focus, every screen
supabase/
  migrations/         SQL migrations (never change the DB by hand)
  seed.sql            demo user + ~3 months of sample records
  tests/              pgTAP: rls, schema, recurring, budgets, analysis
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
carry the money semantics and clear WCAG AA in both themes. A small blocking
script in `<head>` (`app/layout.tsx`) applies the stored choice before the
first paint, so there is no flash of the wrong theme — next-themes ships the
same logic but renders it inside `<body>`, after the element carrying the
background colour.

**Motion** lives in `src/lib/motion.ts` and is deliberately small:

| Export | What it is for |
| --- | --- |
| `FAST` (120ms) | Feedback on something just touched — a pressed button, a selected tile |
| `BASE` (200ms) | Something arriving, leaving or changing shape |
| `COUNT_UP` (400ms) | The longest anything may take: a number counting to its new value |
| `EASE` | One curve, `cubic-bezier(0.2, 0, 0, 1)`, everywhere |
| `PRESSABLE` | The Tailwind classes for a pressable row or button |
| `usePrefersReducedMotion()` | Starts `true`, so nothing animates before the browser has answered |
| `useCountUp(value)` | BigInt in, BigInt out; never animates the first value |
| `useFirstFill(value)` | Zero for one frame, so a progress bar fills rather than appears |
| `useShake()` | One 240ms shake, suppressed under reduced motion |
| `haptic(enabled)` | A 10ms vibration where the device has one and the setting is on |

Everything moves `transform` or `opacity` only, and nothing in the app waits
for an animation before doing its work. `prefers-reduced-motion` is honoured
globally in `globals.css` and per component through `motion-reduce:`.
`docs/premium-pass.md` has the full inventory.

**Type scale and spacing.** Two weights in normal use — 400 for body, 600 for
anything emphasised, including buttons and labels. Sizes are `--text-label`
(11px, uppercase micro-labels), `text-xs`, `text-sm`, `text-xl` (page titles)
and `text-3xl` (the one number a screen is for). Spacing steps are multiples
of 8: `space-y-6` between sections on a screen, `space-y-4` inside a sheet.

**`hoverable:` instead of `hover:`.** Tailwind's built-in variant compiles to a
bare `:hover`, which a touchscreen fires on tap and leaves on. `globals.css`
defines `hoverable:` behind `@media (hover: hover)`; use it for every hover
style so a tapped row does not stay highlighted.

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

## Records

`/records` is the screen the app exists for, so adding one is built to feel
immediate: the row, the day total and the month summary all update before the
server has answered.

**The month lives in the URL** as `?m=2026-11`. The header's stepper and
picker rewrite that one parameter (with `replace`, so stepping through months
does not fill the back stack), the server reads it, and a reload or a shared
link lands on the same month. Anything unparseable, or a month in the future,
clamps to the current one. `src/lib/month-param.ts` is the single reader.

**The keypad is a calculator, not an input.** `120+45` resolves to ₹165.00 on
`=`. `src/lib/calculator.ts` tokenises the expression and evaluates it in
BigInt at a scale of 10⁻⁹ — there is no `eval`, no `Function`, and no float, so
`0.1+0.2` is exactly `0.30` and a pasted `constructor` is just a rejected
token. The result is handed to `toMinor()` with the profile's decimal places,
which is the only thing that ever reaches the database.

**Writes are optimistic.** `records-screen.tsx` holds the list in
`useOptimistic` and registers its own submit and delete handlers with the
shared sheet provider, so the FAB in the app shell saves through the Records
screen whenever that screen is mounted and falls back to a plain action
elsewhere. A save shows the row at once, then merges the server's version by
id; a failure removes it again and says why in a toast. Delete leaves for five
seconds behind an **Undo** toast, which re-inserts the row under its original
id rather than creating a new one. On a phone a left swipe reveals the same
delete.

**Paging** is 40 rows at a time, newest first, by offset: a month is a bounded
set, and a keyset cursor would have to be spliced into a PostgREST filter
string. `loadMoreTransactions` returns the next page to the client, the
sentinel below the list requests it, and already-loaded pages survive a
`router.refresh()`, so editing a row on page 2 does not snap the list back to
page 1.

**Search and filters** live in the URL too (`q`, `type`, `account`,
`category`, `min`, `max`, `from`, `to`), shown as chips above the list with a
clear-all. The note search is a `pg_trgm`-backed `ilike` with the user's own
`%` and `_` escaped so they match literally; the account filter matches either
leg, so an account's history includes transfers into it. Ids are re-validated
as uuids before they go anywhere near a filter string.

**Repeat** on a record creates a `recurring_rules` row alongside the first
transaction and links the two. The record is written first: a rule with no
transaction is a schedule nobody asked for, whereas a transaction with no rule
is just a record. From then on `process_due_recurring()` owns it.

Amounts cross the server/client boundary as minor-unit **strings**: an RSC
payload cannot carry a BigInt, and a `number` would quietly lose precision
above 2^53 paise. `fromDb` / `toDb` in `money.ts` are the only places that
convert.

## Recurring

Rent, salary, a subscription: anything that repeats is a row in
`recurring_rules`, a template plus a schedule. `/recurring` lists them, active
before paused, and each one has its own page with the records it has created
and the next five dates it is due.

**The anchor is what keeps a schedule honest.** "Monthly on the 31st" has to
clamp to 28 February and then come back to 31 March. Stepping a cursor forward
cannot do that — it clamps to the 28th and stays there for good — so every
occurrence is computed from the start date and the anchor day:

```
31 Jan → 28 Feb → 31 Mar → 30 Apr → 31 May
29 Feb 2024 → 28 Feb 2025 → 28 Feb 2026 → 28 Feb 2027 → 29 Feb 2028
```

That arithmetic exists twice — `recurrence_occurrence()` in SQL writes the
rows, `src/lib/recurrence.ts` draws the upcoming list before anything is
written — so both are tested on the same cases
(`supabase/tests/recurring.test.sql`, `src/lib/recurrence.test.ts`), and the
two were checked against each other over a thousand random schedules.

**Nothing is ever created twice.** A unique index on
`(recurring_rule_id, occurrence day)` is the guarantee, not the cursor
arithmetic: `process_due_recurring()` inserts with `ON CONFLICT DO NOTHING`, so
two tabs opening at once, a retried request, or a cursor that was rolled back
all end up colliding there instead of charging the month twice.

**The catch-up runs on page load.** There is no cron in a local Supabase stack,
so the app shell is the scheduler: the first page of a new day calls the
generator, which creates every occurrence missed while the app was closed —
three months away comes back to three months of records — and then stamps
`profiles.last_recurring_check`. A toast says how many were added, and the
screen refreshes so they are there to see. Opening the app again the same day
does nothing at all.

Per rule you can **edit** (future occurrences only — past records never move),
**pause and resume**, **skip the next occurrence** (remembered in
`skipped_dates`, so a catch-up months later still passes over it), and
**delete**, which asks whether to keep the records it created or remove them
too.

Records has an **Upcoming** strip for the week ahead, computed rather than
inserted, with **Pay now** on each item. Paying early books the record on its
own scheduled date — it is the 1 December rent, paid on 28 November — and
moves the rule past it, so the occurrence cannot come round again. Editing a
record a rule created asks whether the change is for that record or for the
rule as well.

### Running the generator in production

Locally the page-load catch-up is the whole story, and nothing below is
shipped. A deployed instance can let Postgres do the work instead, with
`pg_cron` and a wrapper — `process_due_recurring()` reads `auth.uid()`, so it
is per-caller by design and something has to walk the users:

```sql
create extension if not exists pg_cron;

create function public.process_due_recurring_all()
returns integer
language plpgsql
security definer          -- runs as the owner, so it can act for each user
set search_path = ''
as $$
declare
  v_user uuid;
  v_total integer := 0;
begin
  for v_user in select id from auth.users loop
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_user)::text,
      true                -- local to this transaction
    );
    v_total := v_total + public.process_due_recurring();
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.process_due_recurring_all()
  from public, anon, authenticated;

select cron.schedule(
  'paisa-recurring',
  '30 0 * * *',           -- 06:00 IST
  $$ select public.process_due_recurring_all() $$
);
```

The app needs no change if you do this, and the two can run side by side: the
generator is idempotent, so whichever gets there first does the work and the
other finds nothing to do.

## Budgets

A limit per expense category per month, next to what has actually been spent.
The month comes from the same `?m=` the rest of the app uses, so stepping back
through the header's switcher works here too.

**Spent comes from `month_summary`**, the RPC Records and Analysis already
read. That is the whole point: a budget screen whose numbers disagree with the
record list is worse than no budget screen, and sharing the source makes
disagreement impossible rather than unlikely.

**The three states** are green under 80%, amber from 80% to 100%, and red past
it with "Over by ₹X". The threshold is compared in BigInt — `5 × spent ≥
4 × budget` rather than `spent / budget ≥ 0.8` — because the rest of the app
never divides money into a float and this is no place to start. `--warning` is
a palette colour like `--income` and `--expense`, tuned for AA in both themes.

**"₹1,528/day left for 17 days"** divides what is left by the days remaining,
today included. It only appears on the month the user is in, and only while
something is left — telling someone who is over budget what they may spend per
day is not a helpful sentence.

**Recurring awareness.** When a recurring expense is still to come before the
month ends, its category says "includes ₹750 scheduled" beside the amount
left: the ₹1,896 left on Transport already has ₹750 of metro top-ups spoken
for. Occurrences the generator has already created are left out, because those
are in `spent` and counting them twice would be worse than not counting them.

**Apply to all future months** carries a limit forward and stops at the first
month that was set to something else — carrying ₹7,500 forward should not
quietly overwrite the ₹12,000 someone put against December. The horizon is
twelve months; writing rows into 2031 to express "from now on" would be a lie
about how certain anyone is.

**Copy last month** fills in the categories that have no budget yet, which
makes it safe to press twice, and leaves archived categories behind rather
than giving a limit to something that can no longer be chosen.

Both of those walk a run of months, so both are single statements in the
database (`set_budget`, `copy_budgets_from_previous_month`): a run of months
half-written is worse than one not written at all. `budgets.test.sql` covers
the stopping rule, the horizon, and pressing copy twice.

## Analysis

A period, a side of the ledger, and three charts drawn from the same rows
Records lists.

**The period** is Week, Month, Year or a range of your own, with arrows to walk
through them, and it lives in the URL (`?p=month&d=2026-11-01`) so a view can
be shared and the back button steps through what was actually looked at.
`src/lib/period.ts` owns the arithmetic — where a week starts given the
profile's `week_start`, what "the month before" means, how far a custom range
steps — and it is tested, because a period that is wrong by one day is wrong
quietly for months.

**Grouped in the database.** `category_totals`, `period_series` and
`balance_series` each answer one question with one query. Pulling the rows back
to add them up in JavaScript would mean a year of records crossing the wire to
produce twelve numbers, and the arithmetic would then exist twice.

All three evaluate in the profile's timezone, like `month_summary` does, which
is what keeps the charts and the record list agreeing: `analysis.test.sql`
checks the totals against `month_summary` and the closing balance against
`account_balances` rather than against numbers typed into the test.

**The charts.** A donut by category with the total in the hole and a legend
underneath — at 360px a pie with labels around it is unreadable, and every
legend row links into Records filtered to that category over the same dates.
Income against expense as side-by-side bars, daily for a week or a month and
monthly for a year, since stacking them would make "did I earn more than I
spent" a subtraction the reader has to do. And the running balance as an area,
for every account in your total or one you pick, with a y-axis that is *not*
forced to zero — a balance moving between ₹30,000 and ₹34,000 against a zero
baseline is a flat line, which is the opposite of the information wanted.

**At 360px.** Axis values are abbreviated the way the user already reads them
— `formatCompact` gives ₹1.2K, ₹3.4L, ₹1.1Cr for ₹ and K/M/B otherwise — and
the x-axis thins its own labels, because a 31-day month leaves about 11px per
bar. Tooltips trigger on tap rather than hover on a touchscreen, where a hover
tooltip appears under the thumb covering it and then will not go away.

**Colours are CSS variables**, not hex strings: an SVG `fill` of
`var(--income)` resolves against the element's own computed style, so the
charts follow light and dark with no theme hook and no re-render. Category
slices keep their own colour, the one their icon uses everywhere else.

## Settings, export and offline

**Settings** is one form, saved in one go: name, currency, the day a week
starts on, and the theme. Currency is written as a triple — code, symbol and
decimal places, all from the one entry picked — because the exponent decides
what every stored amount *means*, and taking a symbol from one place and an
exponent from another is how ₹12.50 quietly becomes ₹1,250.

Changing a password asks for the current one first. Supabase does not require
it, but without that step anyone who picks up an unlocked phone can lock the
owner out of their own account.

**Deleting an account** removes the `auth.users` row, and the cascades take
everything with it — profiles, accounts, categories, transactions, budgets,
rules. The work is `delete_own_account()`, a `SECURITY DEFINER` function that
takes no arguments and can only ever delete whoever called it. That is on
purpose: the alternative is a service-role key in the app's environment, and a
key that can delete anybody is a much bigger thing to protect than a function
that can delete exactly one person. Typing DELETE is the guard in front of it,
and `account.test.sql` proves both halves — everything of the caller's goes,
nothing of anyone else's does.

**Export** is at `/export` and nothing is locked in:

- **CSV** for any range up to three years: date, time, type, category,
  account, destination, amount and note. Streamed a page at a time from a
  route handler, because the point of a download is that the browser can start
  writing to disk while the server is still reading. Fields that begin with
  `=`, `+`, `-` or `@` are prefixed with an apostrophe — a note reading
  `=HYPERLINK(...)` is a phishing link the moment the file is opened in Excel.
- **PDF** for one month: the summary, spending by category against that
  month's budgets, and the full record list. It reads `month_summary`, the
  same RPC the app shows on screen, so a printed statement cannot disagree
  with the app it came from.

Both check the session before they answer, so an expired cookie gets a 401
rather than an empty file that reads as "you have no records".

**Offline.** The app shell and static assets are precached; a navigation that
cannot reach the network gets `/offline`, which is static for exactly that
reason — it cannot read cookies or call Supabase. Records themselves are not
cached: they are per-user data behind a session, and a stale balance shown
with no sign that it is stale is worse than an honest "you are offline". Every
write goes through a Server Action, so an offline queue would mean
reimplementing the write path against a local store — a feature, not a polish
item.

A new service worker takes over as soon as it installs, so the page watches
for `controllerchange` and offers a reload: that is the only way the JavaScript
running matches the worker serving it. **Install** is offered in More and
About — Chromium's own prompt where it exists, and the Share → Add to Home
Screen instruction on iOS, where there is no prompt to offer.

One thing worth knowing about the manifest: Next streams `metadata.manifest`
into the body, and Chrome only resolves `<link rel="manifest">` from inside
`<head>`. The link is written into the head in `app/layout.tsx` for that
reason — without it the manifest is fetchable, the browser never asks for it,
and the app is quietly not installable.

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
| `recurring_rules` | a transaction template plus a schedule, anchor and skips |

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
  end date. Returns how many it created. Calling it twice changes nothing the
  second time — see **Recurring** above.
- `recurrence_occurrence()` / `recurrence_after()` — the schedule calendar:
  the nth occurrence of a rule, and the first one on or after a date.
- `materialise_recurring()` / `skip_recurring_occurrence()` /
  `delete_recurring_rule()` — pay an occurrence early, skip one, and delete a
  rule with or without the records it created, each in a single statement.
- `set_budget()` / `copy_budgets_from_previous_month()` — the two budget
  writes that span more than one month; see **Budgets** above.
- `category_totals()` / `period_series()` / `balance_series()` — the three
  groupings behind the charts; see **Analysis** above.

`npm run db:test` runs five pgTAP files: `rls.test.sql` puts two real
`authenticated` sessions side by side and checks that neither can read, write
or delete the other's rows, `schema.test.sql` covers the constraints above,
`recurring.test.sql` covers the schedule arithmetic and the generator,
`budgets.test.sql` covers carrying a budget forward and copying a month, and
`analysis.test.sql` checks the chart RPCs against the totals the rest of the
app already shows.

After any migration, regenerate the types — `npm run db:types` — and never
edit `src/types/database.ts` by hand.

## Tests and quality gates

```bash
npm test          # 163 unit tests (vitest)
npm run db:test   # 112 pgTAP assertions across six files
npm run test:e2e  # 6 Playwright tests on a 390×844 phone
npm run typecheck && npm run lint && npm run build
```

The unit tests cover the parts where being wrong is silent: money parsing and
formatting, the timezone arithmetic, the recurrence calendar, the keypad's
expression parser, the period maths, and every zod schema that stands between
a Server Action and the database.

The pgTAP files test the database against itself — RLS with two real
`authenticated` sessions side by side, the constraints, the recurrence
generator, carrying a budget forward, the chart RPCs against `month_summary`,
and account deletion.

The Playwright suite runs against a **production build**, not `next dev`: the
dev server compiles each route on first request, which turns the suite into a
test of the compiler. `journey.spec.ts` signs up a fresh user, reads the
confirmation email out of Mailpit, and goes through onboarding, an expense, a
transfer, a recurring rule, a budget, the charts and a CSV export.
`polish.spec.ts` is the polish pass as a test: axe with WCAG A and AA on every
screen in both themes, no horizontal overflow at 360/390/430/768/1280, every
tap target at least 44px, and a visible focus ring at every stop in the tab
order.

Lighthouse on mobile, against the production build:

```bash
npm run build && npm start
CHROME_PATH=/usr/bin/google-chrome npx lighthouse@11 http://localhost:3000/login \
  --only-categories=pwa,accessibility --form-factor=mobile --screenEmulation.mobile
```

```
accessibility  100
best-practices 100
pwa            100
```

Lighthouse 11 is pinned on purpose: Lighthouse 12 removed the PWA category
altogether, so it can no longer report the score this project is measured
against.

## Status

All nine phases are done: the app shell, the database, auth with onboarding,
managing accounts and categories, the records screen, recurring transactions,
monthly budgets, the analysis charts, and settings with export and the PWA
polish. A new account can sign up, confirm by email, pick a
currency, set an opening balance and land on Records; accounts and categories
can be created, edited, reordered, archived and deleted; records can be added
from any tab, edited, deleted with undo, searched and filtered; anything that
repeats manages itself, catching up whatever was missed and never creating the
same occurrence twice; and each expense category can carry a monthly limit
that knows what is still scheduled against it; Analysis draws the period — by
category, day by day, and the balance over time; and Settings covers the
account, with CSV and PDF exports and an installable, offline-aware shell.

### Deploying

Nothing here is tied to a local stack beyond the values in `.env.local`:

1. Create a Supabase project and push the migrations
   (`supabase link --project-ref <ref>` then `supabase db push`).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `NEXT_PUBLIC_SITE_URL` on the host. The site URL is what auth emails link
   back to — it is read from the environment rather than from the request's
   Host header, which an attacker controls.
3. Add that same URL to the project's **Redirect URLs** in Supabase Auth, or
   confirmation links will be rejected.
4. `npm run build` and serve with `npm start` (any Node host) — the service
   worker is written to `public/sw.js` as part of the build.
5. Optional: schedule the recurring catch-up in Postgres instead of letting
   the first page load of the day do it (see **Recurring** above). Everything
   else needs no background worker.

The app never needs a service-role key, so there is none to leak: every write
goes through RLS as the signed-in user, and the one privileged operation —
deleting your own account — is a `SECURITY DEFINER` function that can only
act on the caller.
