/**
 * Never booking a row twice.
 *
 * Two checks, in order. A row is a duplicate of the account's own records
 * when one has the same type, amount and local date: a statement's row
 * carries no time, so the day is as exact as the comparison can be. And a
 * row is a duplicate within the file when an earlier row is identical to it,
 * note included, which is what an export that repeats itself looks like.
 */

export type DuplicateKind = "existing" | "file";

export type DuplicateCandidate = {
  type: "expense" | "income";
  /** Minor units, positive. */
  amount: bigint;
  /** `yyyy-mm-dd`, the person's local date. */
  date: string;
  note: string | null;
};

/** What the account's records are compared by. */
export function duplicateKey(
  type: string,
  amount: bigint,
  date: string,
): string {
  return `${type}|${amount}|${date}`;
}

export function markDuplicates(
  rows: DuplicateCandidate[],
  existing: ReadonlySet<string>,
): (DuplicateKind | null)[] {
  const seen = new Set<string>();

  return rows.map((row) => {
    const key = duplicateKey(row.type, row.amount, row.date);
    if (existing.has(key)) return "existing";

    const identity = `${key}|${(row.note ?? "").trim().toLowerCase()}`;
    if (seen.has(identity)) return "file";

    seen.add(identity);
    return null;
  });
}
