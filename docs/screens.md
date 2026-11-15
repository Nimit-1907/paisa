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

---

## 10. Add / Edit record sheet

**Purpose.** Log a spend in four taps, and let the unusual case still be
possible without making the usual case slower.

Most of this screen was built in Phases 6–12: the calculator keypad, the
quick-add chips, the category grid ordered by what you use at this hour, the
account and date chips, the "More options" fold, and the save button that
names what it will do ("Save expense · ₹450"). Phase 13 added four things.

**The segmented control slides.** One pill that moves, rather than three that
fade in and out. The movement is the point: it says the three are one choice
with a position, and it carries the eye from where it was to where it now is,
so the change registers without anything flashing. The pill takes the colour
of the type it arrives at, so the sheet's accent follows the choice. Measured
at 390px: the indicator sits at 0, 113 and 226 with a width of 109, and the
background goes expense-soft → income-soft → transfer-soft.

**The note field suggests notes you have written.** Notes repeat far more than
people expect — "DMart run", "Metro card top-up" — and retyping one on a phone
keyboard is most of the effort of logging a record. `note_suggestions()`
returns the last year's notes, most-used first and then most-recent,
deduplicated case-insensitively while keeping the spelling of the most recent
(somebody who switched from "swiggy" to "Swiggy" meant the second). It is a
**native `<datalist>`**, not a combobox of our own: nothing to hydrate,
keyboard-operable everywhere, and — unlike a popup we positioned — it cannot
cover the Save button on a short screen. The limit is clamped server-side, so
a client asking for a million rows gets fifty.

**Dismissing a sheet with something in it asks first.** A sheet is closed by
swiping it down or tapping the backdrop, both easy to do by accident on a
phone and neither of which looks like "throw this away".

The detail that matters: **"changed" is a comparison, not a flag**. A `dirty`
flag set on the first keystroke stays set after the value is typed back to
what it was, and then asks somebody to confirm discarding nothing. The sheet
snapshots every typeable field when it opens and compares. Measured: opening
and closing asks nothing; typing a 5 and closing asks; pressing backspace
first and then closing asks nothing again.

**States.** Loading is the save button's own spinner. Empty does not apply.
Error is inline on the field, which opens "More options" when the field is
folded away — a collapsed section with the error in it is a form that refuses
to save and will not say why. Offline: the save fails and says so. Success is
the Phase 11 ending, with Undo, or Rules where a repeat was created. Partial
data does not apply.

**Screenshots.** `sheet-390-transfer`, `sheet-390-discard`.

---

## 13. Analysis (`/analysis`)

**Purpose.** Answer three questions in order: how much a day, where it went,
and when.

**Layout decisions**

- The period control (Week | Month | Year | Range with arrows) and the
  plain-sentence insight were built in Phases 8 and 10 and are unchanged.
- **A bento grid**: two columns on a phone, six from `lg`. Six because the one
  card worth more room is the donut — it is the answer to "where did it go",
  and at a third of the width its labels collide. The four stat tiles sit
  two-by-two beside it; the two time charts take half the width each, since
  they are read left to right and want length more than height.
- `SummaryCards` returns a **fragment**, not a grid of its own. These four are
  cells in the screen's bento, so the page places them; a nested grid would
  make them one cell wearing four hats and they would not line up with the
  cards beside them.
- The tiles stretch to the donut's height, so their content is vertically
  centred. Content pinned to the top of a 317px card reads as a mistake;
  centred, the empty space is margin.
- Every card is the shared `bento` anatomy, and every figure goes through
  `Amount` — the donut's legend was printing `₹22,000.00` beside rows that
  were not.
- "View as table" was already on each chart, and the chart colours were
  already the app's own tokens rather than hex strings, so a fill resolves
  against the element's computed style and follows light and dark without a
  theme hook.

**Measured** at 390 / 768 / 1280 / 1536: the grid is 2 columns up to 768 and
6 from 1280; the donut is 637×646 at 1280 and 764×646 at 1536; the four tiles
are 150px and 182px wide; the two time charts are exactly half the row each;
no horizontal overflow at any width.

**States.** Loading is `analysis/loading.tsx`, in the shape the charts arrive
in. Empty is "Nothing in this period" with an Add record button. Error and
offline belong to the shell. Success does not apply — nothing here writes.
Partial data: the "average per day" divides by the days that have *happened*,
not the days on the calendar, and says "so far"; "vs previous" says "nothing
to compare" rather than printing a percentage against zero.

**Not done: the per-category detail screen.** The spec asks for a tap on a
category to open a six-month trend with its records and its budget. The donut's
legend already links to that category's records, which is the part that
exists; the six-month trend needs a query that does not exist yet. It is
listed in the gaps at the end of this document rather than half-built.

**Screenshots.** `analysis-390-light`, `analysis-1280-light`.

---

## 14. Budgets (`/budgets`)

**Purpose.** "How much have I got left, and how much is that a day?"

- The hero is now the shared `HeroStat`. The sentence people open this screen
  for — "₹1,624/day for 16 more days" — is the **caption directly under the
  figure**, not the tail of a muted line. The ring keeps its job, the shape of
  the month at a glance, as the hero's `aside` at a weight that does not argue
  with the number beside it.
- Every figure on the screen goes through `Amount`: the hero, the per-row
  "₹2,300 left" / "Over by ₹400", the scheduled-recurring note and the
  unbudgeted list. They had been a mix of trimmed and untrimmed.
- Rows already sorted over-budget first and already carried the bar motif and
  the "includes ₹X scheduled" note from Phase 8; group headings are now
  `SectionHeader`.

**Measured** at 390px: "LEFT TO SPEND / ₹25,981 / ₹1,623.81/day for 16 more
days / 33% / ₹13,019 of ₹39,000 budgeted".

**States.** Loading is `budgets/loading.tsx`. Empty is "No budgets this month"
with Set a budget and, when last month had any, Copy October's. Error and
offline belong to the shell and the sheet. Success is the sheet's toast.
Partial data: a past month gets "You stayed under budget in N of M".

**Not done: the budget detail screen** — day-by-day spending against an ideal
pace line, with that category's records under it. Listed in the gaps.

---

## 15. Accounts (`/accounts`)

**Purpose.** What you have, and where it is.

- **Two figures, one at a time.** "Total balance" is the spendable money — the
  accounts ticked into the total. "Net worth" is every account, including the
  ones left out, which is usually a savings pot somebody deliberately did not
  want counted against this month. Showing both at once invites the question
  of which is the real one; the toggle makes it a choice and the caption says
  which is on screen. The toggle is **hidden when nothing is excluded**, since
  the two numbers would be identical.
- **A Transfer button in the header.** Moving money between your own accounts
  is the thing you come to this screen to do, and it was four taps away
  through the FAB and the Transfer tab. Hidden below two accounts: a transfer
  needs somewhere to go, and a button that can only fail is worse than none.
- Hero on `HeroStat`, headings on `SectionHeader`, figures through `Amount`.

**Measured** at 390px with one account excluded: "TOTAL BALANCE / ₹3,02,996 /
Across 3 of 4 accounts" toggles to "NET WORTH / ₹3,06,612 / Every account,
including the 1 left out of your total", `aria-pressed` flipping with it.

**Not done, and why:**

- **The card grid** (2 columns on tablet, 3 on desktop). The accounts list is
  drag-reorderable, and that ordering is what the bottom of every account
  picker uses. A grid would have to give that up or reimplement it in two
  dimensions, and reordering is a feature people use where a grid is a
  preference. Listed in the gaps.
- **The 30-day trend line per account.** It needs a per-account daily balance
  series, which is a query that does not exist. Listed in the gaps.

**States.** Loading is the shell's. Empty is "No accounts yet" with Add
account. Error and offline belong to the sheet. Success is its toast. Partial
data does not apply.

---

## 18. Recurring (`/recurring`)

**Purpose.** What repeats, what it costs, and what is about to happen.

- **A hero: "Scheduled this month".** Rent, a phone bill and three
  subscriptions are a number nobody holds in their head, and it is the number
  that decides whether a month is comfortable. It leads the screen for the
  same reason the month card leads Records.
  - **Expenses only.** Mixing a salary into "scheduled" gives a figure that is
    neither what goes out nor what is left, and the question being asked is
    the first one.
  - Weekly rules count four times, which is how often they are actually paid
    in most months.
- **Due soon** is the next seven days, and it comes *out* of Active rather
  than being repeated above it. A rule in two lists is a rule somebody pauses
  twice and is surprised the second time.
- Amounts through `Amount`; headings through `SectionHeader`.

**Measured**: "SCHEDULED THIS MONTH ₹24,448 / 1 due in the next 7 days", then
"Due soon · 1" and "Active · 3". The total checks out by hand — ₹250 weekly
×4, plus ₹22,000 rent, ₹799 and ₹649.

**States.** Loading is the shell's. Empty is "No recurring records" with
"Add a repeating record". Error and offline belong to the rule sheet. Success
is its toast. Partial data does not apply.

**Not done: the rule detail timeline** — the next five dates and the history
list. The detail page exists with Pause/Resume, Skip, Edit and Delete from
Phase 6; the timeline is in the gaps.

---

## 17, 19, 21. Categories, More, Export

These three needed no structural change for Phase 13 — they were already a
tabbed tile grid, a grouped list and a form. What they got is the sweep that
went through every screen: the `text-ink-*` emphasis steps in place of
`text-muted-foreground`, the two-radius family in place of `rounded-xl` and
`rounded-2xl`, and `SectionHeader` for group headings.

The radius sweep was not a blanket replacement. `rounded-xl` is 16.8px, which
is neither of this app's two radii, so it became `rounded-card` where it sat
on a card surface and `rounded-control` everywhere else — 48 files, verified
by loading every signed-in screen at 390px and checking for overflow and page
errors.

**Not done on Categories:** drag-to-reorder already exists, but the spec's
"live preview tile at the top of the edit sheet" does not. Listed in the gaps.
