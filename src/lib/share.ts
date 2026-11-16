import type { RecordDraft } from "@/components/records/record-sheet";
import { parseAmount } from "@/lib/amount";
import { instantToLocal } from "@/lib/dates";

/**
 * A payment, read from text another app shared into Paisa: a UPI SMS, or
 * the receipt line a payment app shares ("You paid ₹450 to Rahul").
 *
 * Read on the device, never sent anywhere. It fills Add Record; the person
 * checks it and saves, so a miss costs a correction, not a wrong record.
 */
export type SharedPayment = {
  type: "expense" | "income";
  /** Amount-field text ("1200", "499.5"), or null when none was found. */
  amount: string | null;
  /** Who was paid, or who paid; null when the text does not say. */
  note: string | null;
};

const MONEY = /(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)/i;
const INCOME = /\b(credited|received|deposited|added to)\b/i;
const EXPENSE = /\b(debited|paid|sent|spent|purchase|withdrawn)\b/i;
// Where a payee's name stops: the date, the app, the reference, the end
// of the sentence.
const STOP = String.raw`(?=\s+on\s|\s+via\s|\s+upi\b|\s+ref\b|\.(?:\s|$)|,|$)`;
const MAX_NOTE = 60;

export function parseSharedPayment(text: string): SharedPayment {
  const income = INCOME.test(text) && !EXPENSE.test(text);
  return {
    type: income ? "income" : "expense",
    amount: readAmount(text),
    note: readPayee(text, income),
  };
}

function readAmount(text: string): string | null {
  const match = MONEY.exec(text);
  if (!match?.[1]) return null;

  const plain = match[1].replace(/,/g, "");
  const [whole = "", fraction = ""] = plain.split(".");
  if (!/^\d+$/.test(whole)) return null;

  const paise = fraction.replace(/0+$/, "");
  const amount = paise ? `${Number(whole)}.${paise}` : `${Number(whole)}`;
  return Number(amount) > 0 ? amount : null;
}

function readPayee(text: string, income: boolean): string | null {
  // A UPI handle says it most plainly: "VPA swiggy@icici" is Swiggy.
  const vpa = /\bvpa\s+([\w.-]+)@/i.exec(text);
  if (vpa?.[1]) return shorten(vpa[1]);

  const word = income ? "from" : "(?:to|at)";
  const payee = new RegExp(`\\b${word}\\s+(.+?)${STOP}`, "i").exec(text);
  const name = payee?.[1]?.trim();
  if (!name || /^(your|a\/c|ac|account)\b/i.test(name)) return null;
  return shorten(name);
}

function shorten(name: string): string {
  return name.length <= MAX_NOTE ? name : name.slice(0, MAX_NOTE).trimEnd();
}

/**
 * Shared text as the start of a new record: Add Record opens on it.
 *
 * The account is left for the sheet's per-type guess and the category for
 * the person. With no amount found the amount is zero, which the sheet
 * will not save, and the whole text becomes the note, so a share is never
 * simply lost.
 */
export function sharedDraft(
  text: string,
  {
    decimals,
    timeZone,
    now,
  }: { decimals: number; timeZone: string; now: Date },
): Omit<RecordDraft, "mode"> {
  const payment = parseSharedPayment(text);
  const parsed = payment.amount ? parseAmount(payment.amount, decimals) : null;
  const read = parsed?.ok === true;

  return {
    id: "shared",
    type: payment.type,
    amount: read ? parsed.minor.toString() : "0",
    accountId: "",
    toAccountId: null,
    categoryId: null,
    note: read ? payment.note : text.trim().slice(0, 500) || null,
    occurredAtLocal: instantToLocal(now, timeZone),
    recurringRuleId: null,
  };
}
