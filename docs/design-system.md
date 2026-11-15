# Paisa — the design system

*Phase 14: modern minimal with neo-brutalist accents.*

This is the record of what the language **is** and, where the brief left a
choice open, what was chosen and why. It is written as the migration goes,
batch by batch, rather than at the end — a decision explained three weeks
after it was made is a decision nobody can argue with any more.

The tokens themselves live in `src/app/globals.css`; the palette is mirrored
in `src/lib/tokens.ts` so it can be tested, and `src/lib/tokens.test.ts`
checks every text-on-surface pair in both themes against WCAG AA before
anything else runs. A colour that is not in those two files does not exist:
`grep -rn "#" src/components` should find nothing.

---

## 1. The three ideas

**Flat by default.** Surfaces are separated by a hairline, not by a shadow.
There is no glass, no blur, no noise, no gradient. A flat screen has nothing
to look at except what is on it, which is the point.

**One accent per screen.** Exactly one element carries the hard shadow at
full size (`accent-lg`, 4px): the hero. A handful of small controls carry it
at 2px (`accent-sm`) to say *this one is selected* — the segmented control's
chosen segment, a chosen tile, the dock's Add button. Everything else is
flat. The shadow is a sentence, and a page of them says nothing.

**Colour identifies, ink carries meaning.** The eight tints name a category
or an account; they never say good or bad. The ink does the work: an icon on
a tint is always plain ink (11:1 or better on every tint in both themes),
which is exactly why the tints can stay this pale.

---

## 2. Tokens

### Surfaces and ink

| Token | Light | Dark | What it is |
| --- | --- | --- | --- |
| `--background` | `#f6f6f4` | `#111111` | the page |
| `--surface` | `#ffffff` | `#1a1a1a` | cards, sheets, rows |
| `--surface-muted` | `#efeeea` | `#242424` | tracks, keys, chips |
| `--ink` | `#141414` | `#ededed` | borders, shadows, the primary fill |
| `--on-ink` | `#ffffff` | `#111111` | text on an ink fill |
| `--text` | `#141414` | `#f2f2f2` | body |
| `--text-secondary` | `#6b6a66` | `#a3a3a3` | second lines, labels |
| `--hairline` | `#e4e2dd` | `#2c2c2c` | every border that is not ink |
| `--bar-muted` | `#d6d4ce` | `#3a3a3a` | unselected bars |
| `--accent` | `#c7ceff` | `#4a5293` | periwinkle: Add, new rows |

Money: `--income`, `--expense`, `--transfer`. Three colours, and the app
never invents a fourth.

### Tints

`rose · peach · sky · butter · mint · lilac · peri · neutral`. Stored on the
row as a `public.tint` domain, not as a hex — the sixteen free colours of
Phase 12 are gone, and with them the ability to pick a colour that fails
contrast. Migration `20261115180000_soft_tints.sql` maps the old rows by
**name**, not by colour distance: "Food" should be rose because it is Food,
not because its old orange happened to be nearest.

### Shape

`hero 20 · card 16 · toast 14 · control 12 · segment 9 · dock 22 · sheet 26 ·
dialog 20`. There is no other radius. `rounded-xl` is 14px here and belongs
to nothing in particular, so nothing uses it.

### The two shadows

```css
--shadow-accent-sm: 2px 2px 0 var(--ink);
--shadow-accent-lg: 4px 4px 0 var(--ink);
```

No blur, by definition: `pressable` moves an element `translate(2px, 2px)`
over 80ms, so it travels *into* its own shadow and meets it exactly. A
blurred shadow would smear instead of meeting, and the press would read as a
wobble.

### Type

Two families and no more. **Inter** for everything you read; **Bricolage
Grotesque 800** as the anchor — the hero figure on a screen (one per screen),
page titles, sheet titles and the landing headline. Phase 14 replaced
Instrument Serif: a serif anchor next to hard-edged shadows was two eras in
one screen.

Amounts are three pieces at three sizes: the digits, the currency symbol a
size down (`amount-unit`, 0.82em), the paise smaller again (`amount-minor`).
On a hero figure the symbol drops to 0.5em (`amount-hero`). The hierarchy is
size and weight, never opacity — opacity over the money palette measures
3.0–3.6:1 in light mode, which would make the decimals the one thing on
screen that fails AA.

---

## 3. Decisions the brief left open

Where the reference and the brief disagreed, the brief won. Where neither
said, this is what was chosen.

**The sheet keeps "Add record", not "New record".** The reference's title.
The Phase 13 microcopy glossary says the verb is *Add* everywhere — the dock
button, the empty states, the keyboard shortcut's description. One screen
saying *New* would be the only one.

**"Save and add another" keeps its place beside the save pill.** The
reference shows one full-width button. The run-of-receipts shortcut is a
real feature with a real audience (entering a day's spending in one sitting),
and the icon button costs 48px of a 360px row while the pill still names the
amount.

**The category grid shows seven tiles and a "More".** The reference shows
eight cells, the last of which is More. A third row of tiles pushes the
account, the date and the save button off a 640px phone. If the chosen
category is past the fold it takes the last visible place, because a grid
showing nothing selected on a form that will not save without a selection is
the worse bug.

**The suggested categories were folded into the grid.** Phase 13 gave them a
labelled chip row of their own above the grid; the reference has one grid.
Two rows of the same tiles asking the same question read as two different
sets. They sort to the front instead, and the grid's hint — "Usually in the
afternoon" — says why they are there.

**The keypad sits with the save button, outside the scrolling body.** The
reference fits the whole sheet on one screen; at 390×844 with a quick-add row
and a "More options" row it does not. The keypad is the only way to enter an
amount on a phone (the field itself is visually hidden), so it cannot be
something you scroll to find. The type tabs and the amount are pinned above
for the same reason: a calculator whose display has scrolled away.

**The keypad is hidden from `lg` up.** A 4×4 grid of buttons is the slower
way to type a number where there is a real keyboard, and it was 210px of a
dialog that the category grid needed more. The amount field takes a visible
caret at that size so it still reads as something you can type into.

**The toast sits above the dock, not under the header.** Brief item 24. Its
Undo is an ink pill — the same shape as the primary button — because it is
the only safety net behind a delete.

**Search spans every month; the rest of the app does not.** The month is how
this app is *read* — the switcher, the card, the totals — but it is not how
anybody searches. Results are capped at a hundred rather than paged: a search
returning more than that is a term that is not narrow enough, and saying so
is more useful than an infinite scroll through three years of groceries.

**The filters' type is one choice, not a set.** With three types, ticking two
is the same as excluding the third.

**Field cards hold a native control at zero opacity.** Account, When, From
and To draw their value the way this app draws values (an icon, "Today, 1:30
pm"), which no native control can be made to do, while the thing a tap, a
keyboard and a screen reader actually meet is a real `<select>` or
`<input type="datetime-local">`. The card takes the focus ring on its
behalf and hides its own text from the accessibility tree, so nothing is
announced twice.

---

## 4. Micro-interactions

All of them are decoration: nothing waits on one, and every one is off under
`prefers-reduced-motion`.

| What | How |
| --- | --- |
| Press | `translate(2px, 2px)`, 80ms |
| Segmented control | 220ms on colour, border and shadow |
| Sheets | 250ms (vaul's own) |
| A saved row | washes from the accent back to the surface over 1800ms |
| Hero figures | count to the new value over 600ms |
| Save and add another | the button reads "Saved ✓" for 1200ms |
| The toast | 4500ms, with Undo |

The row wash ends on `--surface` rather than on `transparent`: a row in a
list has its swipe actions painted behind it, and fading to transparent
prints Copy and Delete through the row for a second and a half.

---

## 5. What Phase 14 removed

- the frosted-glass header, and the `backdrop-filter` with it
- the separate floating "+" — the dock carries Add between its four
  destinations, and the sidebar carries it above its list
- the sixteen-colour picker, in favour of eight tints
- Instrument Serif
- every gradient and noise texture
- `font-heading`, which was never defined and so was never doing anything

---

## 6. Still to come

Batches (c) to (f) — Analysis, Budgets, Accounts, Categories, Recurring,
More, Settings, the public pages, auth, onboarding and the system screens.
Each one lands with its screenshots and its ticks in `docs/screens.md`.
