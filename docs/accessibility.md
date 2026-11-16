# Accessibility

Target: **WCAG 2.2 AA**, on a phone first. What follows is what was done, what
was measured, and how to check it again — not a list of intentions.

Run the checks:

```bash
npm run lint          # eslint-plugin-jsx-a11y, strict preset
npm run test:e2e      # axe on every route, keyboard, reduced motion, 320px
```

## Automated

### axe

`e2e/polish.spec.ts` runs axe over all ten signed-in screens in both themes.
`e2e/a11y.spec.ts` covers the four public pages and the three auth pages, also
in both themes, plus **the Add Record sheet while it is open** — a screen scan
never sees a dialog, which is where most of this app's interaction lives.

Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
The assertion is `toEqual([])` — not "no serious or critical", but no violation
of any impact. The suite is what fails CI.

Current result: **0 violations**, 16 e2e tests passing.

Two findings this phase, both from wrapping the charts for screen readers:

- `aria-hidden-focus` (serious) — recharts makes its surface focusable, so a
  keyboard user could tab into an element screen readers were told to ignore.
  Fixed with `tabIndex={-1}` on the chart.
- A `<label>` nested in a `<label>`, and a `<ul role="radiogroup">` whose list
  items sat between the group and its radios. Both restructured.

### eslint-plugin-jsx-a11y

`plugin:jsx-a11y/strict` is on. It found ten problems on its first run:

- A `<div>` with a click handler and no keyboard equivalent (the amount
  display) — now a `<label>`, which focuses its own control for free.
- The nested label and the radiogroup above.
- Six `autoFocus` props. Each is inside a sheet or a wizard step that the
  person has just opened, which is the case the rule is not about, so each
  carries a one-line disable saying so. The rule is about a page that steals
  focus on load; there is none of that here.

`label-has-associated-control` runs with `depth: 3`: a checkbox row here is a
label wrapping the input, a title and a line of explanation, and the default of
two would call that labelless.

## Keyboard

Driven by tests, not by assertion:

- **Skip link.** The first Tab on any signed-in screen focuses "Skip to
  content"; Enter moves to `#main`, past five nav links.
- **Focus into a sheet.** Opening Add Record puts the caret in the amount —
  the field it was opened to take.
- **Focus is trapped.** 30 consecutive Tabs inside an open sheet never leave
  the dialog.
- **Focus comes back.** Escape closes the sheet and returns focus to the
  button that opened it. These sheets open from a context rather than from a
  trigger element, so the dialog had nothing to hand focus back to and was
  dropping it on `<body>` — `useFocusReturn` in `responsive-sheet.tsx`
  remembers what was focused and puts it back, unless that element has since
  been removed (deleting a record takes its row's buttons with it).
- **The amount takes a physical keyboard.** Digits and one `.` type into
  it and nothing else lands, Backspace deletes, and Enter saves.
- **Every focus stop paints something.** A test walks the first fifteen stops
  and fails on any that has neither an outline nor a ring, in both themes.

## Contrast

Measured from the tokens, converting oklch to sRGB and computing the WCAG
ratio. Text needs 4.5:1, UI components and focus indicators 3:1.

| | Light | Dark |
| --- | --- | --- |
| Body text on the page | 16.97 | 17.03 |
| Secondary text on the page | 5.74 | 7.71 |
| Secondary text on a card | 5.99 | 7.07 |
| Income | 5.86 | 10.87 |
| Expense | 6.06 | 7.71 |
| Transfer | 5.84 | 8.91 |
| Warning (budget 80–100%) | 4.99 | 10.41 |
| Destructive | 5.83 | 6.14 |
| Income on its soft background | 5.28 | 7.57 |
| Expense on its soft background | 5.44 | 5.27 |
| Warning on its soft background | 4.51 | 7.22 |
| Button text on `--primary` | 6.26 | 9.41 |
| Focus ring on the page | 4.47 | 5.04 |
| Control border (`--input`) on a card | 3.36 | 3.33 |
| Chart colours on a card | 4.40–6.38 | 7.06–9.96 |

Every text pair clears 4.5:1 and every UI pair clears 3:1 in both themes. The
lowest text figure is the warning colour on its own soft background at 4.51.

`--input` used to be the same hairline as `--border` (1.29:1 on a card), which
left a text field and a switch's off state identified by something invisible.
It is darker now. `--border` is unchanged and does not meet 3:1 on purpose: it
separates surfaces, and no control depends on it to be seen.

## Not colour alone

- Income and expense carry an arrow as well as a colour on the Records
  summary, and a sign on every amount.
- Budget state is a colour *and* a percentage *and* a sentence ("₹800.00
  left", "Over by ₹250.00").
- The donut's legend lists each category by name with its share and amount.
- Selected states use a border and `aria-pressed`, not only a tint.

## Charts

A chart is an SVG, and recharts' own output reads to a screen reader as a list
of paths. So:

- The bar chart and the balance chart are wrapped in `aria-hidden` and
  followed by **View as table** — a real `<table>` with a caption, column
  headers and row headers, holding the same figures the chart is drawn from.
  Closed by default: the chart is the point, the table is the fallback.
- The donut was already followed by a list of every category with its share
  and amount, which is a better alternative than a table would be, so it does
  not get a second one.
- The budget ring is `role="img"` with a label ("36% of the budget used"); the
  bar version is `aria-hidden`, because the figures beside it already say
  spent, budgeted and left.

## Motion

`prefers-reduced-motion: reduce` cuts every transition and animation to
0.01ms, globally, so third-party keyframes (Radix dialogs, vaul sheets) are
covered too. The loading spinner is deliberately exempt — it is a status, and
freezing it leaves a saving button looking stuck. A test asserts that nothing
on a loaded screen animates for longer than 1ms while the setting is on.

## Structure

- One `<h1>` per screen, no skipped levels: verified across all ten signed-in
  screens and the public pages.
- `<main id="main">` in every shell — signed-in, signed-out, onboarding and
  marketing.
- `<nav aria-label="Main">`, `aria-label="Footer"`, `aria-current="page"` on
  the active tab.
- Icon-only buttons carry `aria-label`; decorative icons carry
  `aria-hidden="true"`.
- Errors are announced: field errors render in `role="alert"`, and the
  amount field's message line is an `aria-live="polite"` region.
- Amount fields are `inputMode="none"` and at least 16px, so iOS does not
  zoom on focus. The in-app keypad's keys are buttons with names ("Delete
  last digit", "Decimal point"), they do not take focus from the field, and
  a docked pad stays open while focus is on one of its keys, so a screen
  reader can press them.

## Reflow and zoom

WCAG 1.4.10 asks for 320 CSS pixels, which is a 360px phone at 200% zoom.
Every signed-in screen and every public page is tested at 320, 360, 390, 430,
768 and 1280 for horizontal overflow. Nothing scrolls sideways at any of them.

This caught the bottom nav: its labels had silently reverted to 16px (see
[design-review.md](design-review.md)) and collided at 320px. They are 11px
again, 43–50px of text in a 61px cell.

## What a screen reader is handed

Captured from Chromium's accessibility tree (Playwright's aria snapshot), not
from a screen-reader session — no NVDA, JAWS or VoiceOver run has been done,
and that is the gap in this phase.

What the tree says:

- The tab bar: `navigation "Main"` → `list` → five `listitem`s, each one
  `link "Records"`, `link "Analysis"` and so on, with the current one carrying
  `aria-current="page"`.
- Add Record: `dialog "Add record"` with `heading "Add record" [level=2]`, the
  description as a paragraph, then `radiogroup "Record type"` with
  `radio "Expense" [checked]`, `textbox "Amount"`, and the keypad as named
  buttons — including `button "Backspace"` for the icon-only one.
- A record row reads `Groceries · Paytm Wallet · −₹400.00`: the sign is part
  of the text, so the direction does not depend on the colour.
- The budget ring is `img "36% of the budget used"`.
- "View as table" opens a table captioned *"Income and expense for each day of
  the period"* with `Day / In / Out` headers and one row per day.

## What is not covered

- The PDF export is generated by `@react-pdf/renderer` and is not tagged for
  accessibility. The CSV export is the machine-readable alternative, and both
  come from the same rows.
- axe cannot judge whether a label is the *right* word, whether a focus order
  makes sense, or whether an error message helps. Those were read by hand.
- A real screen-reader pass. The tree above is what the browser exposes; how
  NVDA or VoiceOver reads it out is a different question, and the honest
  answer is that nobody has listened to it yet.
