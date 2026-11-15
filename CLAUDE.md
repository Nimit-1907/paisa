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
- Typography: two families via next/font, and no more.
  Inter is the body face — every list, form and amount, with tabular figures.
  Bricolage Grotesque 800 is the anchor, and it marks the thing you came for:
  the hero figure on a screen (one per screen), page and sheet titles, and the
  landing headline. Phase 12 chose a serif anchor; Phase 14 replaced it,
  because a serif beside hard-edged shadows is two eras in one screen. See
  docs/design-system.md. `font-sans` and `font-display` are the only two font
  utilities any component should use.
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
  Respect env(safe-area-inset-*) for the dock and sheets (iPhone notch/home bar).
- Tap targets ≥ 44×44px. Inputs ≥ 16px font (prevents iOS zoom).
- Use `inputMode="decimal"` for amounts; never rely on hover.
- Navigation: a floating dock on mobile — Records, Analysis, [Add], Budgets,
  Accounts — where the active item is an ink pill with its label and the rest
  are icons with an `aria-label`. On ≥ lg it becomes a left sidebar with an
  accent "Add record" button at the top. Phase 14 merged the bottom tab bar
  and the separate FAB: two pieces of fixed furniture stacked on each other
  cost a fifth of a 640px phone.
- Forms open as bottom sheets (vaul) on mobile, centered dialogs on desktop.
- Use `100dvh`, not `100vh`. Sticky headers with month switcher.
- Skeleton loaders, empty states with a clear call-to-action, and swipe-friendly lists.
- Accessible: semantic HTML, aria-labels on icon buttons, visible focus, AA contrast in both themes.
- Default currency ₹ (INR), user-changeable.
- Colour comes from tokens, never from a literal: `grep -rn "#" src/components`
  must find nothing. Accounts and categories pick one of the eight tints in
  `src/lib/tokens.ts` (rose, peach, sky, butter, mint, lilac, peri, neutral),
  stored as a `public.tint` domain. The icon on a tint is always plain ink,
  which is what lets the tints stay pale — `src/lib/tokens.test.ts` checks
  every pair against AA in both themes before anything else runs. Text uses
  `text-text` and `text-text-secondary`.
  The four places that cannot read a variable — the manifest, `themeColor`,
  the OG image and the splash — write the hex out, and are the only ones.
- Radii come from the family: `hero` 20, `card` 16, `toast` 14, `control` 12,
  `segment` 9, `dock` 22, `sheet` 26, `dialog` 20. There is nothing else;
  `rounded-lg`/`rounded-xl` belong to no size here.
- Surfaces are three layers: page background, `bg-surface`, and `raised` for
  what floats above both (sheets, menus, the command palette). In dark mode
  the lift is a lighter surface and a brighter border, because a shadow on a
  near-black page is invisible.
- Exactly one element per screen carries the accent: `accent-lg` (a 1.5px ink
  border and a `4px 4px 0` shadow with no blur) on the hero. `accent-sm` is
  the 2px version and only ever means *this one is selected* — a segmented
  segment, a chosen tile, the dock's Add button. `pressable` moves an element
  `translate(2px, 2px)` into its own shadow over 80ms; the shadow has no blur
  precisely so the two meet.
- No glass, blur, noise, gradient or soft shadow. Separation is a hairline.
- Amounts render through `<Amount>`, never `formatMoney` called inline. It
  sets the currency symbol and the paise a size down from the digits, honours
  the user's "Show paise in lists" preference, and always leaves the exact
  figure in the accessibility tree. `formatMoney` stays correct for strings —
  toasts, aria-labels, chart tooltips.
- Screens are built from the shared components, not from fresh markup:
  `PageHeader`, `PageShell`, `HeroStat`, `SectionHeader`, `ListRow`, `Card`,
  `ListCard`, `HeroCard`, `Tile`, `TilePicker`, `TintPicker`, `FieldCard`,
  `SegmentedControl`, `ProgressBar`, `RangeCalendar`, `Stepper`, `Pill`,
  `StickyActionBar`, `EmptyState`, `ErrorState`. If a screen needs something
  one of these nearly does, change the shared one.
- How wide a screen is belongs to the screen: `<PageShell>` is 768px for
  anything you read down and `width="wide"` (1200px) for the bento grids on
  Analysis, Budgets and Accounts. The app shell sets no width.
- Every action on a row is reachable three ways — swipe, long-press or
  right-click menu, and a visible control. Nothing lives only behind a
  gesture.
