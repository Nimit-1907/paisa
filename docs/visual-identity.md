# Visual identity and UI detail — Phase 12

Phase 11 chose the feeling: **calm and in control**. This phase gives that
feeling a face, and fixes the small things that were quietly undermining it.

Everything here is measured rather than asserted. The maths for the palette
and the emphasis ladder is in the commit history; the numbers below came out
of it.

---

## Part B — the identity

### Typography: Instrument Serif + Inter

Three directions were built at `/dev/directions` on the same month of data and
compared at 360px and 1280px in both themes. Screenshots:
`docs/screenshots/phase-12/directions-{light,dark}-1280.png`.

| | Anchor | The star | Why it lost / won |
| --- | --- | --- | --- |
| 1. **Bars** | Instrument Serif | A thin bar per day under the figure | **Chosen.** The only one that adds information rather than decoration, and the serif gives the app a face no other tracker has. |
| 2. Dial | Space Grotesk | A ring showing what is left as a share of income | The ring repeats what Budgets already does, and the percentage is a derived number nobody came for. Space Grotesk also sits too close to Inter — two grotesks reads as one font rendering badly. |
| 3. Type | none | The figure, very large, on a dark slab | Handsome and completely silent. A permanent dark panel inside a light app is a statement, and the one it makes is louder than "calm". |

The rule, now in CLAUDE.md: **two families, three places**. Instrument Serif
appears on the month card's figure, page titles and the landing headline.
Everything else — every list, every form, every amount in a row — is Inter
with tabular figures. Both render ₹ and Indian digit grouping correctly;
₹48,931 in the serif was the thing that settled the decision.

### The star: the month card

The figure you came for, over the shape of the month. One thin bar per day,
taller where more went out, today in the brand colour, every bar a link to
that day's records.

It earns its space by being useful: the shape answers "was it one bad week or
all of it?" before any chart is opened.

**The scaling is the whole design problem.** The first version scaled against
the busiest day, and one ₹22,000 rent payment flattened the other twenty-nine
days into identical stubs — a chart that said nothing. It scales to the 85th
percentile of the days with spending instead, so the outlier runs off the top,
which is also the honest way to draw it: that day was off the scale. A day
with nothing on it still gets an 8% stub, so the field reads as a calendar
rather than as a list of the days that happened to have something in them.

### Visual rhyming

| Motif | Where it repeats |
| --- | --- |
| The thin vertical bar | The month card, the landing hero's phone mock-up, budget progress bars (same `rounded-full` hairline), the Records skeleton |
| Radius family | `rounded-card` 20px, `rounded-control` 12px, `rounded-full` for every chip — quick-add, budget suggestions, account pills |
| The accent wash | The month card, and the landing mock-up's month card. One gradient, two places, both of them the star |
| Grain | The month card only (and the landing's copy of it) |

### Depth

- **Grain**: inline `feTurbulence`, fixed seed, 3.5% opacity (5% in dark).
  Zero requests, a few hundred bytes. It stops a large flat panel reading as
  a hole in the page.
- **Glass**: one `glass` utility on the bottom tab bar, the sticky page header
  and the sticky sheet footer. Three fallbacks, all declarative: a solid
  surface when `backdrop-filter` is unsupported (`@supports`), a solid surface
  under `prefers-reduced-transparency: reduce`, and `Canvas` under
  `forced-colors: active`. The solid fallback is the colour the glass averages
  to, so text contrast is identical either way.

---

## Part A — the detail audit

Audited at 360px and 1280px, both themes.

### Fixed

| # | Found | Fixed |
| --- | --- | --- |
| 1 | — | Measured: every top-level block on Records, Budgets, Accounts and Recurring starts at 16px and ends at 16px from the other edge. The inner edges that differ are card borders and card padding, which is nesting, not drift. |
| 1 | — | Measured: 48 of 48 `.amount` elements carry tabular figures. |
| 3 | Sixteen swatches picked one at a time: Tailwind-ish mid tones disagreeing about lightness and saturation, so eight categories read as eight alarms | One lightness and one chroma for all sixteen (OKLCH L 0.55, C 0.12). Every swatch carries a white icon at ≥4.4:1 and stands at ≥3.1:1 against both page backgrounds. |
| 3 | Money colours at full chroma | A third less saturated, and softened again in dark where a saturated colour glows. Measured on the page: income 6.2, expense 6.2, transfer 6.0, warning 5.2. |
| 3 | Icons on coloured circles assumed white | `ColorDot` picks light or dark ink from the circle's luminance. Every palette colour resolves to white — the function is there for colours stored before the palette existed, where a pale icon on a pale circle is invisible rather than merely ugly. |
| 3, 7 | Six components each hand-building the same coloured circle, at sizes 24/28/36/40/44 with 14/18/20px icons | One `ColorDot`: 28/36/40px circles carrying 16/20px icons. Nothing in between. |
| 4 | Emphasis was `--foreground` and `--muted-foreground` and nothing else | Three steps as solid colours, not opacity over a surface: `--ink` 14.9:1, `--ink-2` 6.8:1, `--ink-3` 4.6:1 against the page in light; 16.5, 8.9 and 6.3 in dark. |
| 4 | Small uppercase labels had no letter spacing | `tracking-[0.08em]` on the card label. |
| 8 | "Save" asked you to remember what you had typed | The button says what it will do: "Save expense · ₹450", "Move ₹2,000 to Paytm Wallet". It falls back to the plain verb while there is no usable amount, so it never reads "Save expense · ₹0". |
| 8 | Two full-width buttons sharing the footer | One primary, full width, naming the amount. "Save & add another" is an icon button beside it — the rarer action, and spelling it out cost the primary the room to name the amount. |
| 9 | The sheet footer scrolled away behind the on-screen keyboard | Sticky, frosted, and lifted by `visualViewport` so Save is never the thing underneath the keyboard. Zero on every browser without the API. |
| 10 | — | Quick-add chips and budget suggestions, both from new RPCs. See below. |
| — | Hard-coded `#64748B` in seven components as the "no colour" fallback | `FALLBACK_COLOR` from the palette. The only literal colour left in any component is the dot ink, and that is a token. |

### Smart suggestions, from real data

- **Quick add** (`quick_adds()`): up to six category + amount + account
  combinations seen at least three times in sixty days. Grouped by that
  triple because that is what a repeat purchase is — "Tea ₹20 from Cash" is
  one habit, "Tea ₹250 on the card" is another. Amounts round to the rupee
  before grouping, so ₹20.00 and ₹20 are one habit rather than two
  near-misses that each fall below the threshold. One tap fills the form; it
  does not save, because the usual amount is not necessarily today's.
- **Budget suggestions** (`budget_hints(month)`): last month's spend and the
  three-month average for the chosen category, rounded to a number somebody
  would choose — ₹8,000 rather than ₹7,842. Rounded **up**, because a limit
  below what was spent last month is a limit that is already broken. Absent
  entirely for a category with no history.
- Both take the month or the window as an argument rather than reading the
  clock, and both are computed in Postgres. Shipping sixty days of rows to a
  browser to count them would be slower, heavier and a worse answer.

### Not done

Two items from the brief are not in this phase, and are not pretended to be:

- **Collapsing headers** on the account and budget detail pages. The sticky
  header exists and the big number is in the first view; the collapse
  animation is not built.
- **Tapping a bar** on the month card. Built, then removed — see the note
  under Checks. The behaviour lives on the day headings instead.
- **The app icon and favicon** do not carry the bar motif. They are PNGs, and
  the repository's commit review blocks new binaries — the same constraint
  that kept the landing-page screenshot a vector. The OG card and the iOS
  launch screens, which are generated rather than committed, do carry the
  mark.

---

## Tokens

All of it lives in `src/app/globals.css` and `src/lib/colors.ts`.

| Token | Light | Dark | For |
| --- | --- | --- | --- |
| `--ink` | `oklch(0.26 0.02 255)` | `oklch(0.95 0.005 250)` | Anything you must read |
| `--ink-2` | `oklch(0.46 0.016 255)` | `oklch(0.76 0.012 255)` | Supporting text |
| `--ink-3` | `oklch(0.555 0.013 255)` | `oklch(0.665 0.012 255)` | Hints, placeholders, micro-labels |
| `--income` | `oklch(0.47 0.095 157)` | `oklch(0.8 0.105 158)` | Money in |
| `--expense` | `oklch(0.5 0.135 22)` | `oklch(0.76 0.115 22)` | Money out |
| `--transfer` | `oklch(0.49 0.105 258)` | `oklch(0.77 0.09 255)` | Between your own accounts |
| `--radius-card` | 20px | | Cards |
| `--radius-control` | 12px | | Controls |
| `--color-dot-ink` | `oklch(0.2 0.02 255)` | same | The dark icon for a pale circle — not themed, because the circle is not |

**On the tertiary step.** The brief asks for ~45% emphasis. At that weight it
measures 3.5:1, which fails AA, and axe is a build gate here — any text using
it would fail the suite. It is held at 4.6:1 instead: a smaller step than
asked for, and a deliberate one.

### The palette migration

`20261115120000_curated_palette.sql` moves every stored colour onto the new
sixteen, **by position rather than by distance**. The two lists are in the
same hue order, so amber stays amber and gold stays gold; nearest-colour would
have collapsed that pair onto one swatch and quietly made two of somebody's
categories identical. Anything that is not one of the old sixteen falls back
to the nearest new swatch, compared in linear light rather than on the hex
digits.

The migration also replaces `default_categories()` and the signup trigger.
Without that it would have been a one-off: existing categories would move and
the next person to sign up would get the old sixteen back.

---

## Checks

| Check | Result | Target |
| --- | --- | --- |
| Categories and accounts off-palette, after migration | 0 and 0 | 0 |
| Icon contrast on every palette swatch | ≥ 4.39:1 | 4.5 for text; these are icons |
| Swatch against both page backgrounds | ≥ 3.1:1 | 3:1 |
| Text emphasis steps, both themes | all ≥ 4.5:1 | 4.5:1 |
| `.amount` elements without tabular figures | 0 of 48 | 0 |
| Hard-coded colours left in components | 0 | 0 |
| axe, WCAG 2.2 AA, 17 routes, both themes | 0 violations | 0 |
| e2e suite | 24 passing | — |
| Unit tests · database tests | 177 · 128 passing | — |
| Lighthouse mobile, landing (median of 3) | perf **94**, a11y **100**, best practices **100**, SEO **100** | ≥ 90 perf, ≥ 95 a11y |
| First Contentful Paint · CLS | 0.77s · 0 | — · < 0.1 |
| Largest Contentful Paint | **2.75s** | < 2.5s — **missed** |

**The LCP miss, continued.** Phase 11 left it at 2.57s against a 2.5s target,
caused by the hero's device preview. The anchor font adds a second woff2 to
the landing page — 15KB, preloaded, arriving at 42ms alongside Inter — and
2.75s is where that lands. Both fonts are on the critical path because the
headline and the mock-up's figure are the things above the fold that use
them. Dropping the serif from the landing headline would recover most of it;
that would also mean the first thing a visitor sees no longer matches the
app, which is the whole point of the phase. The trade is deliberate and the
number is reported rather than rounded.

**One design decision was forced by a test.** The month card's bars were
links to each day's records, exactly as the brief asks. axe failed it:
thirty bars across 328px is a seven-pixel target, against the 24 that WCAG
2.5.8 requires and the 44 this app promises. No spacing trick fixes a target
that small. The bars are decoration now, and the day headings in the list
below carry the link instead — same destination, full width, and more
discoverable than a seven-pixel bar ever was.
