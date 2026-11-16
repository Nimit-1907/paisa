# Quick-add chips: hold to save

## Why
Product review: the spends people repeat exactly ("Transport ₹250") still
cost three taps (+, chip, Save). The owner chose: a tap keeps filling the
form; a long-press saves at once, with the usual "Expense saved · Undo"
toast.

## Goals and non-goals
- Hold a chip ~500ms in Add Record: an expense is saved with the chip's
  amount, account and category, dated now, no note; the sheet closes; the
  shared save toast offers Undo.
- A tap is unchanged. Nothing lives only behind the gesture: tap + Save
  still does the same thing.
- No double save (the sheet's save guard applies); a hold that ends never
  also counts as a tap; no text-selection callout on a held chip.

## Approaches
- **Long-press saves (chosen)**; tap saves (rejected: a mis-tap creates a
  record); skip (rejected).

## Design
- `src/hooks/use-hold.ts`: `useHold(onHold, ms = 500)` returns pointer
  handlers and `wasHeld()`, so the click that ends a hold is ignored. The
  keypad's ⌫ (hold to clear) moves onto it.
- `record-sheet.tsx`: chips use it; `quickSave(quick)` submits through the
  same `onSubmit` as Save, guarded by `savingRef`, then closes.
- Chips get `title="Tap to fill, hold to save"`.
- e2e: on the demo account, hold the first chip, expect the sheet closed and
  "Expense saved", then Undo.
