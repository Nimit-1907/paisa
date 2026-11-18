/**
 * Which column of an imported file holds what.
 *
 * Matched on whole names after normalising, never on a substring: "Amount"
 * is the amount, "Amount Type" is not, and a wrong match is worse than an
 * empty one the person fills in.
 */

export type AmountMode = "single" | "split";

export type ColumnMapping = {
  date: number | null;
  description: number | null;
  /** Used when `mode` is "single". */
  amount: number | null;
  /** Used when `mode` is "split": a debit is spent, a credit received. */
  debit: number | null;
  credit: number | null;
  /**
   * A column that says which way each row went, "expense" or "income" (or
   * Dr/Cr). Paisa's own export has one, and its amounts carry no sign, so
   * without it every row came back as the same type.
   */
  type: number | null;
  mode: AmountMode;
};

/** In order of preference: "Txn Date" beats "Value Date" when both exist. */
const SYNONYMS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date"],
  amount: ["amount", "amt"],
  debit: ["debit", "withdrawal", "withdrawal amt", "dr"],
  credit: ["credit", "deposit", "deposit amt", "cr"],
  type: ["type", "transaction type", "txn type", "dr cr"],
  description: [
    "description",
    "narration",
    "remarks",
    "particulars",
    "details",
    "note",
    "memo",
  ],
} as const;

type Role = keyof typeof SYNONYMS;

/** "Withdrawal Amt." → "withdrawal amt", "Amount (INR)" → "amount". */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function autoMap(headers: string[]): ColumnMapping {
  const names = headers.map(normaliseHeader);
  const taken = new Set<number>();

  const find = (role: Role): number | null => {
    for (const synonym of SYNONYMS[role]) {
      const index = names.findIndex(
        (name, column) => name === synonym && !taken.has(column),
      );
      if (index !== -1) {
        taken.add(index);
        return index;
      }
    }
    return null;
  };

  const date = find("date");
  const description = find("description");
  const debit = find("debit");
  const credit = find("credit");
  const split = debit !== null && credit !== null;
  const amount = find("amount");
  const type = find("type");

  return {
    date,
    description,
    amount,
    debit: split ? debit : null,
    credit: split ? credit : null,
    type: split ? null : type,
    mode: split ? "split" : "single",
  };
}
