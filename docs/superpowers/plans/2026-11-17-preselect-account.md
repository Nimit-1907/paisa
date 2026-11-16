# Pre-select the account per type: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Record opens with the account last used for the record's type already chosen.

**Architecture:** `entry_defaults()` (Postgres) returns one last-used account per type; `getEntryDefaults()` parses it; a pure helper in `src/lib/entry-account.ts` decides the sheet's account; `record-sheet.tsx` applies it on open and on a type switch unless the person or a chip already chose.

**Tech Stack:** Supabase Postgres + pgTAP, Next.js 15, React 19, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-preselect-account-design.md`

## Global Constraints

- Never overwrite an account chosen by hand, by a quick-add chip, or an edit's own account.
- No archived account is ever pre-selected.
- The guess comes from the records (the database), never from localStorage.
- Migrations only, never the DB by hand; run `npm run db:types` after the migration. No `any`.
- No em dash in user-facing strings.

## Review Focus

1. The last expense's account was archived since: Expense falls back to the first active account, not to the archived one (pgTAP in Task 1, unit in Task 2).
2. Transfer with history whose To equals the guessed From after a hand change of From: To must not equal From (unit in Task 2).
3. A brand-new user with one account and no records: every type pre-selects that account; transfer To stays "" (unit in Task 2).
4. Opening and closing an untouched pre-filled sheet asks no "Discard changes?" (e2e in Task 3).
5. Switching Expense, then Income, then back to Expense after picking an account by hand keeps the hand-picked account (unit in Task 2, via the `chosenByHand` input).

---

### Task 1: `entry_defaults()` returns the last account per type

**Files:**
- Create: `supabase/migrations/20261117090000_entry_defaults_per_type.sql`
- Create: `supabase/tests/entry-defaults.test.sql`
- Modify: `src/types/database.ts` (regenerated)
- Modify: `src/lib/queries/accounts.ts:332-375` (`EntryDefaults`, `getEntryDefaults`)

**Interfaces:**
- Produces: `entry_defaults()` JSON gains `lastAccounts: { expense: uuid|null, income: uuid|null, transfer: uuid|null, transferTo: uuid|null }` and drops `lastAccountId`. TS type `EntryDefaults` gains `lastAccounts: LastAccounts` where `export type LastAccounts = { expense: string | null; income: string | null; transfer: string | null; transferTo: string | null }`; the fallback object everywhere uses all four `null`.

- [ ] **Step 1: Write the pgTAP test** `entry-defaults.test.sql`, following `transaction-type.test.sql`'s setup (own user, `set local role authenticated`, `request.jwt.claims`). Accounts: Bank, Card, Wallet, Old (archived after use). Records: expense on Card (older), expense on Old (newest expense, Old then archived), income on Bank, transfer Bank→Wallet. Assertions, `plan(4)`:
  - `(entry_defaults()->'lastAccounts'->>'expense')::uuid` is Card's id (newest expense whose account is not archived).
  - `->>'income'` is Bank.
  - `->>'transfer'` is Bank and `->>'transferTo'` is Wallet.
  - `entry_defaults() ? 'lastAccountId'` is false.
- [ ] **Step 2: Run** `npx supabase test db` → the new file FAILS (no `lastAccounts`).
- [ ] **Step 3: Write the migration**: `create or replace function public.entry_defaults()` with the same body as `20261114230000_entry_defaults.sql` except `last_used` is replaced by one lateral lookup per type: newest (`occurred_at desc, id desc`) record of that type for the user, joined to a non-archived account (and, for `transferTo`, a non-archived `to_account_id`). Keep `stable`, `set search_path = ''`, the comment updated, and the same grants.
- [ ] **Step 4: Run** `npx supabase migration up && npx supabase test db` → all files PASS. Then `npm run db:types`.
- [ ] **Step 5: Parse it in `getEntryDefaults()`**: keep only uuids (`isUuid`), else `null`; update the error fallback and `src/lib/sheet-data.ts:33`'s empty default. `npx tsc --noEmit` passes.
- [ ] **Step 6: Commit** `feat(records): entry_defaults knows the last account for each type`.

### Task 2: The rule that picks the sheet's account

**Files:**
- Create: `src/lib/entry-account.ts`
- Test: `src/lib/entry-account.test.ts`

**Interfaces:**
- Consumes: `LastAccounts` from Task 1.
- Produces: `export function guessAccounts(input: { type: TransactionType; last: LastAccounts; activeAccountIds: string[]; current: { accountId: string; toAccountId: string }; chosenByHand: boolean }): { accountId: string; toAccountId: string }`.

- [ ] **Step 1: Write the failing tests** (`describe("guessAccounts")`):
  - `"uses the last account for the type"`: expense, `last.expense = "card"` → `accountId "card"`, `toAccountId ""`.
  - `"falls back to the first active account when the type has no history"`: income, `last.income = null`, active `["bank","card"]` → `"bank"`.
  - `"ignores a last account that is no longer active"`: `last.expense = "old"`, active `["bank"]` → `"bank"`.
  - `"guesses both ends of a transfer"`: `last.transfer = "bank"`, `transferTo = "wallet"` → `{ "bank", "wallet" }`.
  - `"never makes To the same as From"`: transfer, no history, active `["bank","card"]` → `{ "bank", "card" }`; with active `["bank"]` → `{ "bank", "" }`.
  - `"keeps what the person chose"`: `chosenByHand: true`, current `{ "card", "" }` → returned unchanged for every type.
  - `"leaves an empty account list empty"`: active `[]` → `{ "", "" }`.
- [ ] **Step 2: Run** `npx vitest run src/lib/entry-account.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `guessAccounts`** in `src/lib/entry-account.ts`.
- [ ] **Step 4: Run** the same command → PASS; `npx vitest run` → all pass.
- [ ] **Step 5: Commit** `feat(records): the rule for which account a new record starts on`.

### Task 3: The sheet uses it, and the copy says so

**Files:**
- Modify: `src/components/records/record-sheet.tsx` (open effect ~line 180-225, `TypeTabs onChange`, `AccountPicker onChange`s, quick-add chip `onClick`)
- Modify: `src/app/(marketing)/page.tsx`, `src/app/(marketing)/_content.ts`
- Modify: `e2e/journey.spec.ts:178-216`
- Modify: `CLAUDE.md` only if it states the old rule (it does not today; check)

**Interfaces:**
- Consumes: `guessAccounts` (Task 2), `entryDefaults.lastAccounts` (Task 1), `accounts` prop (already active-only).

- [ ] **Step 1: Update the e2e journey first** (the test for this task): in "add an expense", drop `chooseAccount(page, "Account")` and assert `page.getByRole("button", { name: /^Account, required: Cash$/ })` is visible; in "add a transfer", drop `chooseAccount(page, "From")`, assert From reads `Cash` (the expense's account is Cash; with no transfer history From falls back to the first active account, Cash), and keep `pick(page, "To", "Paytm Wallet")`. Add a step after the expense: open Add record, then Cancel, and expect no "Discard changes?" dialog.
- [ ] **Step 2: Run** `npx playwright test e2e/journey.spec.ts` against a fresh `npm run build && npm start` → FAIL at the Account assertion ("Choose").
- [ ] **Step 3: Wire the sheet**: a `accountChosen` state (false on open; true on any `AccountPicker` change and on a chip click). On open of a new record, and in `TypeTabs onChange`, set accounts from `guessAccounts({ type, last: entryDefaults.lastAccounts, activeAccountIds: accounts.map(a => a.id), current: { accountId, toAccountId }, chosenByHand: accountChosen })`. Edits keep `editing.accountId`/`toAccountId`. The `opened.current` snapshot uses the guessed values so an untouched sheet is not dirty. Replace the comment that says "No account is chosen for you" with why it now is (per type, from the records).
- [ ] **Step 4: Copy**: landing `page.tsx` paragraph becomes "The account and the date are already filled in and the categories you use at this time of day come first. A spend you repeat is one chip that fills in the amount too: tap +, tap it, save." `_content.ts` track body: "The sheet opens on the account you last used for that kind of record, with the categories you usually pick at this hour first. Type the amount, pick the category, save. The spends you repeat sit on one-tap chips that fill in all three."
- [ ] **Step 5: Run** `npx tsc --noEmit && npx eslint && npx vitest run`, then rebuild and `npx playwright test e2e/journey.spec.ts e2e/a11y.spec.ts e2e/polish.spec.ts` → all PASS.
- [ ] **Step 6: Commit** `feat(records): Add Record opens on the account last used for its type`.
