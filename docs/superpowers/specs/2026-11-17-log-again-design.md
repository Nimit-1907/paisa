# "Log again" on a record

## Why

Product review: people repeat purchases that are not regular enough for a
quick-add chip (a bill paid every few weeks, the same dinner place). Today
re-entering one means typing all of it again. Duplicate existed once and was
removed because the row's swipe had only two slots and CLAUDE.md requires
every row action three ways (swipe, long-press/right-click menu, visible
control). The owner chose to make the swipe hold two buttons.

## Goals

- "Log again" on any record opens Add Record prefilled from it: type,
  amount, account (and To for a transfer), category, note. Dated now. Not
  linked to its recurring rule. Nothing is saved until the person taps Save.
- Reachable three ways: swipe right reveals **Edit** and **Log again**
  side by side; the long-press/right-click menu lists Edit, Log again,
  Delete; the record's own sheet shows Delete, Log again, Edit.

## Non-goals and anti-goals

- No one-tap save: it always opens the sheet (the amount may differ today).
- It must never edit or delete the original record.
- Opening a prefilled sheet and cancelling it untouched asks nothing.
- "Show similar" stays gone.

## Approaches

- **Swipe shows two buttons (chosen).** `ListRow`'s `swipeLeft`/`swipeRight`
  take one action or a list; the reveal width is 88px per action.
- Menu and sheet only (rejected: breaks the three-ways rule).
- Skip it (rejected by the owner).

## Design

- `src/components/shared/list-row.tsx`: `swipeLeft`/`swipeRight` accept
  `RowAction | RowAction[]`. The parked offset becomes 88px × that side's
  action count; the snap rule moves into a pure, tested helper
  (`settleSwipe`). Buttons render side by side, first action nearest the
  edge. Single-action callers are unchanged.
- `src/lib/record-draft.ts`: `logAgainDraft(record, timeZone, now)` returns
  the draft with `occurredAtLocal` = now in the profile's zone and
  `recurringRuleId` = null. Unit tested.
- Record sheet provider: `openLogAgain(draft)` opens the sheet with the draft
  and no `mode`, which the sheet already treats as a prefilled add (Save
  creates a new record; the account counts as chosen).
- `record-row.tsx` and `record-detail.tsx` gain the action (icon
  `CopyPlus` from lucide), wired from `records-screen.tsx`.
- e2e: the journey logs its expense again from the row menu and checks a
  second record with the same note appears.

## Left to the builder

The exact lucide icon if `CopyPlus` reads poorly at 20px; the button order
inside the sheet footer beyond "Delete left, Edit right".
