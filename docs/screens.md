# Screens

Phase 13: the modern UI/UX pass, screen by screen. One section each —
what the screen is for, what was decided and why, which states it covers, and
what the screenshots show.

Phases 10–12 set the rules this applies: purpose first, AA contrast in both
themes, one focal point per screen, reduced motion respected, mobile-first at
360px, quiet purposeful motion, the bar motif, Inter + Instrument Serif,
colour only from tokens. Those still hold; where Phase 13 changes one, the
change is logged here and in CLAUDE.md.

Screenshots are at `docs/screenshots/<screen>-<width>-<theme>.png`, four per
screen, regenerated with `node scripts/shots.mjs [screen…]`. That directory
is gitignored — the repo carries no binaries, and the pictures that *gate* the
build are the Playwright baselines in `e2e/visual.spec.ts`.

---

## Glossary

The words this app uses, and the ones it does not. Every label, button,
toast, empty state and heading uses the left-hand column. Sentence case
everywhere, second person, no jargon.

| Word | Means | Never |
| --- | --- | --- |
| **Record** | One expense, income or transfer. | transaction, entry, item, log |
| **Account** | Where money sits: cash, a bank, a card, a wallet. | wallet (as a general term), source |
| **Category** | What a record was for. | tag, label |
| **Budget** | A monthly limit on one category. | goal, cap, target |
| **Recurring** | A rule that creates records on a schedule. | repeat (as a noun), subscription, schedule |
| **Transfer** | Money moved between two of your own accounts. | internal transaction, move (as a noun) |
| **Expense** / **Income** | Money out / money in. | debit, credit, spend (as a noun) |
| **Month** | The month on screen, which the header switches. | period, cycle |

Phrases that recur, fixed so they read the same everywhere:

- **"Left to spend"** — a budget's remaining amount. Not "remaining",
  not "available".
- **"Over by ₹400"** — past a budget. Not "exceeded", not "-₹400".
- **"Not enough data yet"** — an insight that cannot be computed honestly
  from a few days. Not "N/A", not a zero.
- **"You are offline"** — the connection is gone. Not "no internet",
  not "connection error".
- Verbs name the object: **"Save expense"**, **"Move ₹2,000 to HDFC"**,
  **"Set budget"** — never a bare "Save", "Submit" or "OK".

---

## The states matrix

Every screen below answers all six. Where a state cannot occur, the section
says so and why, rather than leaving a gap.

| State | What it looks like |
| --- | --- |
| **Loading** | A skeleton in the shape of what arrives — `RowSkeleton`, `HeroSkeleton`, `CardSkeleton`. Never a spinner where a layout is known. |
| **Empty** | Illustration or icon, one sentence, one button. `EmptyState`. |
| **Error** | What happened in our words, and a retry. `ErrorState`. Never a database message. |
| **Offline** | Cached screen with an `Offline` pill in the header; writes disabled with a sentence saying why. |
| **Success** | The Phase 11 ending: haptic, one toast that names what happened, Undo where undoing is safe. |
| **Partial data** | "Not enough data yet" rather than a number computed from three days. |

---

## 6. Landing (`/`)

**Purpose.** One decision: start. Everything on the page either supports that
decision or gets out of its way.

**Layout decisions**

- Hero is the headline in Instrument Serif, one supporting sentence, one
  primary button — **"Get started free"** — and **"See how it works"** as a
  text link beside it. A text link rather than a second button: two buttons of
  equal weight present two decisions where there is one.
- The star element is the drawn `AppPreview`, beside the headline from `lg`
  up and below it on a phone.
- Three feature blocks (Track, Budget, Recurring), each carrying a crop of the
  screen it describes. The crops are **drawn from the app's own tokens**, not
  captured as images. A PNG would be heavy, soft at 3x unless heavier still,
  stale the moment a colour token changes, and — on the page whose whole job
  is painting fast — three more render-blocking requests on a page that is
  already missing its LCP target by 250ms.
- Privacy section, then an FAQ, then a final CTA, then the footer with
  Features, FAQ and Privacy.
- **The FAQ is `<details>`, not a component.** It is an accordion in the way
  that matters — one question a row, opens and closes, works from the
  keyboard — and it costs the page nothing to hydrate. The full FAQ at `/faq`
  leaves every answer open instead, because that is the page search engines
  read for rich results and a collapsed answer does not qualify for them.
- **The sticky header earns its background by scrolling**, driven by a CSS
  scroll timeline rather than a scroll listener. This keeps the marketing
  pages what they have been since Phase 10: server-rendered markup with
  nothing to hydrate. The keyframe has only a `from`, so the implicit `to` is
  the header's own glass — every way it can fail (no scroll-timeline support,
  a reduced-motion rule collapsing the duration) fails to a header that is
  simply always frosted. Measured: transparent at the top, glass past 72px,
  and glass under `prefers-reduced-motion: reduce`.

**States.** Loading, error and offline do not apply — it is a static server
-rendered page with no data to fetch and no writes. Empty cannot occur. The
only dynamic state is the header's scroll position.

**Screenshots.** `landing-360-light`, `landing-360-dark`, `landing-1280-light`,
`landing-1280-dark`. No horizontal scroll at 360 (measured: 0px).
