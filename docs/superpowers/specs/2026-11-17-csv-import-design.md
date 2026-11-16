# Import records from a CSV

## Why

Product review (P2): a new user arrives with months of history in their
bank or another app, and Paisa can only start from today. Charts, budgets
and "vs last month" are empty for a month. The owner chose: any CSV, map
the columns, preview, import; duplicates skipped; categories guessed from
the person's own history with a fallback they pick.

## Goals

- A new screen, **Import** (`/import`), listed in More and the sidebar's
  Manage group next to Export (it closes the "Import has never been built"
  note in `src/app/(app)/more/page.tsx`).
- **Step 1, file:** pick or drop a `.csv` (≤ 2 MB). Parsed on the device;
  nothing is uploaded until Import.
- **Step 2, map:** the header row's columns, auto-matched by name and
  changeable with the shared `Select`:
  - Date (required). Date format: DD/MM/YYYY (default), MM/DD/YYYY,
    YYYY-MM-DD; month names ("05 Nov 2026", "5-Nov-26") parse in any.
  - Either one **Amount** column (sign convention picker: "Negative is
    spent" default, or "Positive is spent"), or **Debit** + **Credit**
    columns (debit = expense, credit = income). Auto-pick the pair when
    both headers exist.
  - Description (optional) → the record's note (trimmed, ≤ 500 chars).
  - Account (required): one of the person's open accounts, for every row.
  Header synonyms to auto-match (case-insensitive): date: date, txn date,
  transaction date, value date, posting date; amount: amount, amt;
  debit: debit, withdrawal, withdrawal amt, dr; credit: credit, deposit,
  deposit amt, cr; description: description, narration, remarks,
  particulars, details, note, memo.
  Amount text: strip currency symbols, spaces and grouping commas;
  "(123.45)" and a trailing "Dr" mean negative, "Cr" positive. Zero and
  blank amounts are skipped as "not a record".
- **Step 3, preview:** every parsed row as expense or income, amount,
  date, note and category, with counts: to import, duplicates, unreadable
  (with the first few reasons). Each row's category is changeable; one
  **Fallback category** select per type (expense, income) fills rows with
  no guess. Import is disabled until every row has a category.
- **Category guess:** from the person's last 12 months of records, a map of
  note "keyword" → most used category for that type. A row gets a category
  when its description's first meaningful word (lowercased, digits and
  punctuation stripped, ≥ 3 letters, not a stop word like "upi", "pos",
  "neft", "imps", "to", "from", "payment") equals a past note's keyword.
  Pure, tested.
- **Duplicates:** matched as a count, not a set. Each record the account
  already has of the same type, amount (minor units) and local date
  cancels exactly one matching row of the file. Identical rows within one
  file are not duplicates of each other: two ₹50 coffees on one day are
  two records, and re-importing that file finds two existing records and
  imports nothing. Checked on the server at import time (authoritative),
  and shown in the preview from a server lookup over the file's date range.
- **Import:** one server action, zod-validated, ≤ 2000 rows, inserted in
  one batch under RLS; answers `{ imported, skipped }`; toast "Imported 182
  records, 4 skipped"; revalidates the record screens; links to Records.

## Non-goals and anti-goals

- No transfers (a CSV row cannot say which other account); no bank
  presets; no Excel/PDF; no editing amounts or dates in the preview.
- Never import a row twice by re-uploading the same file.
- Never store the file.
- Never create categories or accounts.

## Approaches

- **Any CSV with column mapping (chosen).**
- Bank presets as well (rejected: needs real sample files).
- Skip (rejected).

## Constraints

CLAUDE.md applies in full: shared components (`PageHeader`, `PageShell`,
`Card`, `FieldCard`, `Select`, `SegmentedControl`, `ListRow`,
`StickyActionBar`, `EmptyState`, `ErrorState`), money as BIGINT minor units
via `src/lib/money.ts`/`src/lib/amount.ts`, dates in the profile timezone
via `src/lib/dates.ts`, server action returns `ActionResult`, 44px targets,
16px inputs, no native `<select>`, tokens only, no em dash in strings. No
new dependencies (write the CSV parser: RFC 4180 quotes, CRLF, BOM, `,`
and `;` delimiters detected from the header).

## Left to the builder

File names and component split; how many preview rows render at once (all
counted, a long list may page); exact copy beyond what is quoted here.
