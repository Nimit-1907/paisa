# Investments: a ledger of its own

Prototype the user approved: https://claude.ai/artifact/WfwK1uw1GGKeR2MCz2eoNq

## Intent

Track how much money went into investments and how much came back out,
overall and by goal. The kinds are SIPs, mutual fund lump sums, RD, FD,
stocks/ETF, PPF, EPF, NPS, gold, crypto and other. The user asked for
something sensible and useful, without features that don't earn their place.

## Goals

- Invested, Redeemed and Net (invested minus redeemed) per investment,
  overall (open investments) and per goal.
- SIP and RD instalments post themselves on their date.
- FD and RD maturities are remembered and prompt for the payout.
- Goals have an optional target and show progress towards it.

## Non-goals

- **No link to accounts, records, categories, budgets or Analysis.** The
  user asked for a separate module.
- **No valuation:** no NAV or price fetching, no interest maths, no profit
  or loss. The maturity amount is whatever was typed from the receipt.
- No step-up, export/import, PDF, charts or push notifications in v1.
- The Records upcoming strip and an FD "Renew" button were cut to keep the
  module separate and simple.

## Approaches considered

1. **Investment accounts plus transfers** (reuse `accounts` and
   `transactions`). Rejected: it ties investments into balances, Analysis
   and budgets, which the user explicitly did not want.
2. **Investments as recurring rules plus a category.** Rejected for the same
   reason.
3. **Three new tables plus their own engine** (chosen). Investments stay
   isolated. The engine reuses the recurring date arithmetic
   (`recurrence_occurrence` / `recurrence_after`), so "monthly on the 31st"
   behaves identically in both modules.

## Design

### Tables

- `investment_goals` holds name, tint and an optional target.
- `investments` holds the kind, goal, platform, folio and note. It has
  optional maturity fields (FD and RD) and optional schedule fields:
  - A SIP or RD must have a schedule.
  - PPF, EPF and NPS may have one.
  - Other kinds may not.
- `investment_entries` records invest or redeem, the amount, optional units
  and price, the date and a note, plus `scheduled`.

CHECKs enforce the shape per kind. Ownership triggers stop a row from
pointing at another user's goal or investment, and RLS is the usual four
policies.

### Totals

Totals are never stored. The `investment_summary` view computes them, the
same way account balances work.

### The engine

`process_due_investments()` posts what each open, unpaused schedule owes up
to today.

- A unique index on (investment, day) for scheduled entries makes it
  idempotent.
- It runs in the app shell's once-a-day catch-up, beside recurring rules,
  and on create, resume and reopen.

### Pause, resume and reopen

- Pause posts nothing.
- Resume and reopen restart from today, without a backlog.
- Skipping remembers the date.
- Closing stops the schedule.

### Editing

An edit re-anchors the schedule from the next instalment, which can't be in
the past. Past entries are never changed.

### Payout

`record_investment_payout` records the redemption and optionally closes the
investment in one step. The prompt appears:

- in "Coming up" on Investments,
- on the detail page,
- as a toast on the first visit of a day once a deposit has matured.

### Screens

- Investments (under More, and in the sidebar's Manage group) shows:
  - the Net invested hero, with Invested and Redeemed under it and "this
    month" as its helper line,
  - Coming up for the next 30 days,
  - goal cards (tap one to filter the list),
  - the list, with Open and Closed.
- The detail page shows the totals, Invest and Redeem, the maturity, the
  schedule (Pause and Skip), the details, the entries, and Edit, Close and
  Delete.

### Guards

- A redemption above what is still in warns but is allowed, since a gain
  can do that.
- The maturity date must come after the first deposit.
- Amounts must be above 0.
- The maturity date follows the start date plus the tenure until the user
  picks one.

## Calls made during the build

- Investments take their tint and icon from their kind, with no picker.
  This is enough to tell eleven kinds apart.
- A SIP always repeats. A "SIP" with no schedule is a mutual fund lump sum,
  which has its own kind.
- Frequencies are monthly, quarterly and yearly, stored as monthly ×1,
  monthly ×3 and yearly ×1.
- The empty state offers only "New investment". Goals can be added once the
  first investment exists, and assigned through Edit.
