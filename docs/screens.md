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

---

## 7. Auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`)

**Purpose.** Get one person through one gate, with nothing else on screen.

**Layout decisions**

- One centred card on a phone. From `lg` it **splits**: the app preview on
  the left, the form on the right. A form 384px wide floating in the middle of
  a 1,280px window reads as an error page, and the left half is the only place
  a signed-out visitor sees what they are signing in to.
- The grain sits over the whole frame rather than over the card, because these
  screens are mostly empty surface and that is what the texture is for. It is
  the same `Grain` the month card uses — moved to `components/shared/` now
  that two places want it.
- **"Forgot password?" moved up beside the Password label.** Under the field
  it sat between the password and the submit button, so the thing you tab to
  after typing your password was the way out of the form. `FormRow` grew an
  `action` slot for this.
- **The last email used is filled in.** Per-device, in `localStorage`, wrapped
  in try/catch — a private window makes those accessors throw, and a sign-in
  page that crashes because it could not remember an address is worse than one
  that does not remember. Set in an effect rather than as a default value, or
  the first client render would not match the server's. Focus then goes to the
  password, which is the field that person was going to fill in anyway. Only
  the address: the password belongs to the browser's password manager, which
  the `autoComplete` attributes already hand it to.

**The password checklist (signup)**

A checklist, not a bar. A bar answers "how good is this?" with a number
nobody can act on, and the usual implementations rate `P@ssw0rd!` well and
`correct horse battery staple` badly.

The honest difficulty: the schema enforces **one** rule — eight characters.
A checklist of four rules that look mandatory and are not teaches people that
this app's messages can be ignored. So it shows one **required** line and
three **"Stronger if it also:"** lines, visually and textually separated.

`passwordAdvice()` is tested against `signUpSchema` directly, so the
checklist and the gate cannot disagree and say "done" to something the submit
will bounce. Length is counted in code points, so eight emoji are eight
characters to the person typing them. Measured in the browser:

| typed | required | 12+ | number/symbol | not common |
| --- | --- | --- | --- | --- |
| *(nothing)* | not yet | *hidden until typing starts* | | |
| `pass` | not yet | not yet | not yet | done |
| `password` | **done** | not yet | not yet | **not yet** |
| `kitchen table 99!` | done | done | done | done |

**Check your email**

- Names the address it sent to. "Check your email" is useless if you have
  three, and this is the last moment a typo is catchable — seeing `nimt@…` on
  screen turns a dead end into a correction.
- **Resend after 30 seconds**, with the countdown shown. Offering it
  immediately mostly spends someone's rate limit on a second copy of an email
  already in flight. Measured: disabled on arrival, "You can ask for another
  in 30 seconds."
- The timer keeps ticking past the threshold rather than clearing itself —
  clearing it meant a second send, which resets the count, had nothing left to
  tick it back up, and the button stayed disabled for as long as the screen
  was open. Found and fixed before it shipped.
- `resendConfirmation` answers the same way whatever happens, like
  `requestPasswordReset` already did: a different answer for "no such account"
  would let an anonymous caller test addresses one at a time. Rate limiting is
  the one failure worth saying out loud, because waiting is something a person
  can actually do.

**States.** Loading is the submit button's own spinner — there is no data to
fetch, so no skeleton. Empty does not apply. Error is inline on the field plus
a toast, in our words, never the auth server's. Offline: the submit fails and
the toast says to check the connection. Success for sign-in is the app;
for signup and reset it is the Check-your-email panel. Partial data does not
apply.

**Screenshots.** `login-*`, `signup-*`, `forgot-*` at both widths and themes,
plus `signup-360-checklist` and `forgot-360-sent` for the two states a static
visit cannot show.
