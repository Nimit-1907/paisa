# Share a payment into Paisa

## Why

Product review (P2): after paying in GPay, PhonePe or Paytm, or on a UPI
SMS, people retype what the phone already knows. The owner chose: accept
**shared text** only (no screenshots/OCR). Paisa appears in the phone's
share sheet once installed; the shared text opens Add Record with the
amount and payee filled in. Nothing leaves the device beyond the normal
page load.

## Goals

- The web manifest declares a `share_target`: `action: "/share"`,
  `method: "GET"`, params `title`, `text`, `url`. (GET needs no service
  worker, which Paisa no longer has.)
- `/share` (signed-in, under the app layout so the record sheet exists):
  reads `title` and `text`, parses them, replaces the URL with `/records`,
  and opens Add Record prefilled: type, amount, note (the payee). The
  account is the per-type guess as for any new record; the category is
  for the person to pick; the amount is replaceable by the first key, as
  with Log again. Nothing is saved until Save.
- When nothing parses (no amount), Add Record still opens, with the shared
  text as the note, so the share is never lost.
- `parseSharedPayment(text)` in `src/lib/share.ts`, pure and tested,
  returns `{ type: "expense" | "income", amount: string | null, note:
  string | null }`:
  - amount: the first money figure: "₹1,200", "Rs. 250.00", "Rs 5,000",
    "INR 499", "Rs.250" (grouping commas and the currency marker dropped,
    at most two decimals, > 0); returned as amount-field text ("1200",
    "250", "499.5").
  - type income when the text says credited / received / deposited /
    "added to"; otherwise expense (debited, paid, sent, spent, purchase).
  - note: the payee: the words after "to" (expense) or "from" (income),
    or after "VPA", up to " on ", " via ", " UPI", " Ref", " ref", a
    full stop or the end; a bare VPA keeps its handle before "@"
    ("swiggy@icici" → "swiggy"); trimmed, at most 60 characters. Null
    when none is found.
  - Test cases at least: a bank UPI debit SMS, a UPI credit SMS, "You paid
    ₹450 to Rahul Sharma", "Paid ₹1,200 to Zomato via PhonePe", "Rs 5,000
    credited to your a/c XX1234 from RAHUL K on 17-11-26", text with no
    amount, two amounts (first wins), an amount with paise.
- e2e: visiting `/share?text=…` signed in opens the sheet with the amount
  and note filled; Cancel leaves no record.

## Non-goals

No images/OCR, no files, no saving without the sheet, no SMS reading
(the person shares), iOS (no web share target there; documented).

## Approaches

Shared text (chosen); text and screenshots (rejected: heavy, unreliable);
skip (rejected).

## Left to the builder

Where in the code the prefilled sheet is opened (a client component on
/share using the record sheet provider's prefilled-add entry, the one Log
again uses); copy of the "Shared from another app" hint if any.
