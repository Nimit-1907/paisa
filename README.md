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

`supabase start` prints the local credentials:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOi...
```

Those two values are what `.env.local` holds (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). They are the CLI's defaults — identical on
every machine, valid only against 127.0.0.1, and not secrets. Stop the stack
with `supabase stop` (add `--no-backup` to wipe the volume).

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
| `npm run db:types` | Regenerate `src/types/database.ts` — run after **every** migration |

## Project layout

```
src/
  app/
    (app)/            records, analysis, budgets, accounts, more,
                      categories, settings  — share the app shell layout
    layout.tsx        Inter, viewport (viewport-fit=cover), theme, toasts
    manifest.ts       PWA manifest (/manifest.webmanifest)
    sw.ts             Serwist service worker (built to /public/sw.js)
  components/
    layout/           app shell: bottom nav, sidebar, sticky page header
    records/          FAB + Add Record sheet
    ui/               shadcn primitives
  hooks/              use-media-query
  lib/
    money.ts          minor-unit parsing/formatting (+ money.test.ts)
    nav.ts            the five tabs, in one place
    supabase/         server.ts, client.ts, middleware.ts, env.ts
  middleware.ts       refreshes the Supabase session on every navigation
supabase/migrations/  SQL migrations (never change the DB by hand)
```

## Conventions worth knowing

**Money is never a float.** Amounts are BIGINT minor units (paise) end to end.
`src/lib/money.ts` parses user input (`toMinor`) and formats at the very edge
(`formatMoney`, Indian 2-2-3 grouping for ₹). Covered by `npm test`.

**Mobile first.** 360px is the design width. Bottom tab bar + FAB on phones,
left sidebar from `lg` up with the content capped at 768px. Safe-area insets
are respected via the `pt-safe` / `pb-safe` / `pb-nav` utilities in
`globals.css`. Tap targets use the `touch` / `icon-touch` button sizes (44px).

**Theme.** `next-themes` with light/dark/system. Colours are CSS variables in
`globals.css`; `--income` (green), `--expense` (rose) and `--transfer` (blue)
carry the money semantics and clear WCAG AA in both themes.

## Status

Phase 1 (project setup + app shell) is done: every tab renders a placeholder
with an empty state, the FAB opens the Add Record sheet (bottom sheet on
mobile, dialog on desktop), and the PWA manifest/icons/service worker are in
place. Auth, the database schema and real records land in Phase 2 — the
middleware already refreshes sessions and has the marker for the redirect.
