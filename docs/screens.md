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

---

## 8. Onboarding (`/onboarding`)

**Purpose.** Three questions, then the first expense. Nothing is asked twice,
and nothing is asked that Settings could not change later.

**Layout decisions**

- Three steps — **You → Currency → Account** — with a thin progress bar, step
  labels, and Back from step two onward. A fourth screen ends it.
- The currency list already had the five the spec asks for at the top
  (₹, $, €, £, AED) and a search over code, name and symbol. Rows are 56px.
- **Continue moved into a sticky bottom bar** (`StickyActionBar`, the one the
  sheets use). That needed the page to change shape: it was a vertically
  centred block, and a bar can only stick to the bottom of something that
  reaches the bottom. The page is now a full-height column with the step
  centred in the space left over. Measured at 390×844: the bar's bottom edge
  is at 844.
- **Auto-focus, with one exception.** Step one focuses the name — the only
  field on screen. Step three focuses the opening balance, since the account
  name above it is already filled in. **Step two does not**: it is a list to
  pick from with a sensible answer already selected, and opening the keyboard
  would cover the list in order to offer a search nobody asked for.
- Errors are scoped to the field that caused them. They had all been rendered
  under the opening balance, which is the wrong place for a message about the
  second account's name. Scoping them introduced a second problem, which
  review caught: everything is submitted from the last step, so a complaint
  about the name or the currency pointed at a field two steps back and was
  therefore shown nowhere. A field→step map sends the user to the step that
  owns it. Measured: a 120-character name submitted from step three lands back
  on step one with "That name is a bit long." under the field.

**The second account**

The spec asks for an "Add bank account" option. It is a disclosure on step
three rather than a fourth step — most people finish with one account, and a
step that exists to be skipped makes setup feel longer than it is. Opening it
focuses the name field, since the panel appeared in answer to a tap.

Two things review caught here, both real, both about writes that have to
survive being run twice:

1. **The insert was not idempotent**, while the Cash account beside it already
   had the update-or-insert shape. Setup is not finished until the profile
   write lands, so anything failing after the account write leaves the user on
   this screen to try again — and a plain insert hands them a second HDFC each
   time. It is matched on name now.
2. **Naming the second account "Cash"** would have found the *first* account
   and overwritten its opening balance with the bank's, finishing setup with
   the balance lost and no second account made. The rule lives in
   `onboardingSchema` as a cross-field refine, so the form and the action
   cannot disagree about it, with the lookup excluding the first account's id
   as a second line of defence.

Verified against the database rather than assumed:

| run | what was done | accounts afterwards |
| --- | --- | --- |
| first | setup with HDFC at ₹25,000 | `Cash/cash/0/sort 0`, `HDFC/bank/2500000/sort 1` |
| retry | `display_name` set back to null, same name, ₹31,000 | still two; HDFC now `3100000` — corrected, not duplicated |
| clash | second account named "Cash" | refused, "Give the second account a different name." under `bankName`, nothing written |

**States.** Loading is the Start-tracking button's own spinner. Empty does not
apply — every step has a default. Error is inline under the field that caused
it plus a toast, and a dropped connection is caught explicitly so the button
cannot sit on "Setting up…" for ever. Offline: the save fails and says so.
Success is the welcome screen, whose one button is "Add your first expense"
and which goes through `startTracking()` so the shell is rebuilt and the
navigation happens in one step. Partial data does not apply.

**Screenshots.** `onboarding-360-step1/2/3`, `onboarding-360-done`,
`onboarding-360-nameclash`, `signup-360-sent`.

---

## 12. Search and filters

**Purpose.** Stop reading the month, find one thing.

**Search is a mode, not a field.** It takes the whole screen on a phone and
becomes a dialog from `lg`. A box tucked inside the filters sheet made
searching a three-tap detour, and the keyboard covered the results anyway.
It lives at `?search=1`, like `?add=1` does, so a refresh keeps it open and
the back button closes it.

Under the input are the only two things worth offering:

- **Recent searches**, which on a phone is most searches. Five, newest first,
  matched case-insensitively so "Swiggy" after "swiggy" moves the one entry up
  instead of making a second. Stored per device in `localStorage` with every
  accessor wrapped — a private window makes them throw — and **shaped on the
  way out**, because what is in storage was written by an older version of the
  app, another tab, or by hand in devtools. Twelve tests cover that shaping
  and the blocked-storage path.
- **One-tap filters**: this month, over ₹1,000, income only, then the six
  categories most used, each with the same coloured dot the rows carry.
  A list of forty category names is a wall of text; the colour is how people
  find the one they want.

**Nothing is searched as you type.** A query per keystroke over a month of
records is a lot of work to render a list nobody is reading yet, and the
keyboard's own Search key is the gesture people already have. The input is
`type="search"` with `enterKeyHint="search"` so that key says so.

**Active filters are chips you can take off.** A filter you cannot see is a
filter you forget, and "where did my records go?" is the support question that
follows. The count on the Filter button says *how many*; the chips say
*which*. Each reads as a sentence fragment — "Food", "over ₹1,000",
"from 1 Nov" — because a bare value with no preposition is a guessing game
about which field it belongs to. Removing one knows the difference between a
single-valued parameter and a list: taking one category off leaves the others
alone.

An id with no category behind it — a hand-edited URL, or something deleted in
another tab — still gets a chip, labelled generically, so it can be taken off
rather than being invisible and permanent.

**The filters sheet** gained date-range presets (last 7 days, last 30 days,
first half, second half) and coloured category chips. The presets are built
from today each time they render, not once at module load: a tab left open
overnight would otherwise offer yesterday's "last 7 days". A second tap on
the active preset clears it, so the chips are not a one-way door.

**Measured.** Opening focuses the input; typing "metro" and pressing Enter
gives `?q=metro`, 4 records, and a `"metro"` chip; reopening shows "metro"
under Recent; "Last 7 days" fills `2026-11-09`→`2026-11-15` and a second tap
empties both.

**States.** Loading: the list behind keeps its own skeleton. Empty: the
records empty state switches to "Nothing matches those filters" with a Clear
filters button. Error and offline are the list's. Success is the result set
itself. Partial data does not apply.

**Screenshots.** `records-390-search`, `records-390-filtered`,
`records-390-filters`.

---

## 11. Record detail

**Purpose.** Everything about one record, and every way out of it.

**The trade, stated.** Opening a row used to go straight to the edit sheet,
which is the fastest route to fixing a typo and the slowest to everything
else: duplicating, finding the rest of a category, or seeing which rule
created a record were all behind a long-press that announces itself to
nobody. This adds one tap before editing and puts every action on a record in
one visible place. The fast path survives — the row's own menu still has Edit
on it, so people who know the gesture keep it.

**Layout decisions**

- A sheet on a phone, a centred dialog from `lg`, through the same
  `ResponsiveSheet` every other sheet uses.
- The amount is the hero, in the anchor serif, coloured by kind, and
  **always exact**: a list can trim ".00", but the screen you opened to check
  an amount cannot. `paise="show"` overrides the preference here.
- Then the facts, as a `<dl>`: category with its dot, account (or
  "Cash → HDFC" for a transfer), the full date and time, the note, and
  "See the rule" when a recurring rule made it.
- Duplicate and Show similar side by side; Delete as a quiet text button;
  Edit as the one primary action in the sticky footer. Duplicate takes the
  full width on its own when there is no category to be similar to — a
  disabled button explaining why the other one is missing is noise where a
  gap would do.
- **Deliberately not a form.** Everything here is a fact or a place to go; the
  moment it holds a value it has to worry about saving, and there is already
  a sheet that does that properly.

**Held by id, not by value.** The record behind an open sheet can change
underneath it — an edit saved from the sheet, a refresh landing, the row
deleted in another tab. Looking it up each render means the sheet shows what
is true now and closes itself when the row is gone, rather than displaying a
record that no longer exists.

**Measured.** Tapping a row opens "Transport — Metro card top-up / −₹250.00 /
Category / Account / When / Note / Repeats"; Edit swaps to the edit sheet;
Show similar lands on `?m=2026-11&category=…` with a "Transport" chip.

**States.** Loading does not apply — the record is already in the list that
opened it. Empty cannot occur. Error and offline belong to the actions it
launches. Success is the sheet closing behind an edit or a delete, with the
list's own toast and Undo. Partial data does not apply.

**Not done: the two-pane desktop layout.** The spec asks for list left,
detail right at `lg`. The app shell currently caps every signed-in screen at
768px, which is too narrow to split, and widening it is a change to how every
page sizes itself. That is in the responsive pass (Part C) rather than
smuggled in here; until then the detail is a centred dialog on desktop, which
shows the same thing.

**Screenshots.** `records-390-detail`.
