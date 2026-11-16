# Add Record pre-selects the account, per type

## Why

Product review, item P0: every new record cost two extra taps (open the
Account picker, pick a tile) because the sheet opened on "Choose". The
landing page promised the account would already be filled in. Commit
9c76a17 removed the preselection on purpose: a guess "books the money
against the wrong bank without anybody noticing". The owner has now
decided to pre-select it, and chose the version that guesses least wrongly.

## Goals

- A new record opens with an account already chosen.
- The guess is the account last used **for the same type**: an expense
  gets the last expense's account, income the last income's, a transfer
  the last transfer's From and To.
- Switching the type tab moves to that type's account, unless the person
  already chose one themselves.

## Non-goals and anti-goals

- No device-side memory (localStorage): the guess comes from the records,
  so it is right on a second phone too (the reason `entry_defaults()` lives
  in the database).
- Never overwrite a choice the person made: a picked account, a quick-add
  chip's account, an edit's own account all win over the guess.
- No archived account is ever pre-selected.

## Approaches

- **A. Last record of any type.** What existed before 9c76a17; no database
  change. Rejected: after a credit-card expense, Income would open on the
  credit card, the exact wrong-bank case.
- **B. Last record of the same type (chosen).** One migration to
  `entry_defaults()`, returning an account per type.

## Design

- Migration replaces `public.entry_defaults()`. It keeps
  `suggestedCategoryIds` and `partOfDay` as they are, and replaces
  `lastAccountId` with `lastAccounts`:
  `{ expense: uuid|null, income: uuid|null, transfer: uuid|null,
  transferTo: uuid|null }`, each from the newest non-deleted record of that
  type whose account is not archived. pgTAP test in
  `supabase/tests/entry-defaults.test.sql`. Regenerate `src/types/database.ts`.
- `getEntryDefaults()` parses `lastAccounts` (uuids only, as it does for
  categories).
- A pure helper decides the sheet's account on open and on a type switch:
  per-type guess, else the first active account, else "". Unit tested.
- `record-sheet.tsx` applies it when a new record opens and when the type
  tab changes, unless the account was set by hand or by a chip (tracked
  with a flag, like `amountPrefilled`). Edits keep their own account.
- The discard check snapshots the pre-selected values, so opening and
  closing an untouched sheet still asks nothing.
- Landing and features copy say the account is filled in again.
- e2e journey: expects the preselection rather than picking an account
  where it now no longer needs to.

## Left to the builder

Naming of the helper and the flag; whether the transfer's To falls back to
the second account when there is no transfer history (yes, if it differs
from From).
