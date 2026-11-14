# Project: "Paisa" — Mobile-first Expense Tracker (web app)

## Product
A personal finance web app inspired by the Android app "MyMoney — Track Expense & Budget".
Simple, fast, no clutter. Users log income/expenses/transfers across multiple accounts,
set monthly category budgets, and view clean analysis charts.
Primary device: phones (360–430px wide). Must also look good on tablet/desktop.

## Tech stack (do not deviate without asking)
- Next.js 15+ (App Router, TypeScript strict, Server Components + Server Actions)
- Supabase running LOCALLY via Supabase CLI (`supabase start`), Postgres + Auth
- @supabase/ssr for server/client/middleware clients
- Tailwind CSS v4 + shadcn/ui (Radix) components
- vaul (bottom sheet drawers), lucide-react (icons), recharts (charts)
- react-hook-form + zod (forms & validation), date-fns (dates)
- next-themes (light/dark/system)
- @serwist/next (PWA service worker), sonner (toasts)
- @react-pdf/renderer (PDF export)

## Engineering rules
- Money is stored as BIGINT in minor units (paise/cents). Never use floats for money.
  Format only at display time using the user's currency symbol + decimal places.
- Every table has user_id and Row Level Security: user can only access own rows.
- All mutations go through Server Actions validated with zod; return typed results
  { ok: true, data } | { ok: false, error }. Show errors via toast.
- Generate DB types with `supabase gen types typescript --local > src/types/database.ts`
  after every migration. No `any`.
- Folder structure:
  src/app/(auth)/...      login, signup, forgot-password
  src/app/(app)/...       records, analysis, budgets, accounts, categories, settings
  src/components/ui       shadcn primitives
  src/components/<feature>  feature components
  src/lib/supabase        server.ts, client.ts, middleware.ts
  src/lib/money.ts        parse/format helpers (minor units <-> display)
  src/actions/<feature>.ts  server actions
  supabase/migrations     SQL migrations (never edit DB by hand)
- Use optimistic UI (useOptimistic) for add/edit/delete of records.
- Keep components small; colocate feature logic.

## Mobile-first UX rules (non-negotiable)
- Design at 360px first, then scale up. No horizontal scroll anywhere.
- Viewport: width=device-width, initial-scale=1, viewport-fit=cover.
  Respect env(safe-area-inset-*) for bottom nav, FAB and sheets (iPhone notch/home bar).
- Tap targets ≥ 44×44px. Inputs ≥ 16px font (prevents iOS zoom).
- Use `inputMode="decimal"` for amounts; never rely on hover.
- Navigation: fixed bottom tab bar on mobile (Records, Analysis, Budgets, Accounts, More);
  on ≥ lg screens it becomes a left sidebar and content max-width ~ 768px.
- Floating "+" button (above bottom nav) opens Add Record bottom sheet from any main tab.
- Forms open as bottom sheets (vaul) on mobile, centered dialogs on desktop.
- Use `100dvh`, not `100vh`. Sticky headers with month switcher.
- Skeleton loaders, empty states with a clear call-to-action, and swipe-friendly lists.
- Accessible: semantic HTML, aria-labels on icon buttons, visible focus, AA contrast in both themes.
- Default currency ₹ (INR), user-changeable.
