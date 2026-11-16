/**
 * Never booking a row twice, and never merging two real purchases.
 *
 * Matching is a count, not a set. Each record the account already has, of
 * the same type, amount and local date, cancels exactly one row of the
 * file: a statement's row carries no time, so the day is as exact as the
 * comparison can be. Two identical rows in one file are two records, two
 * ₹50 coffees on the same day, and once both are in, re-uploading the file
 * finds two existing records and cancels both.
 */

export type DuplicateCandidate = {
  type: "expense" | "income";
  /** Minor units, positive. */
  amount: bigint;
  /** `yyyy-mm-dd`, the person's local date. */
  date: string;
};

/** What a row and the account's records are compared by. */
export function duplicateKey(
  type: string,
  amount: bigint,
  date: string,
): string {
  return `${type}|${amount}|${date}`;
}

/** How many of each key there are. */
export function countKeys(keys: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** Which rows an existing record cancels, in file order. */
export function markDuplicates(
  rows: DuplicateCandidate[],
  existing: ReadonlyMap<string, number>,
): boolean[] {
  const left = new Map(existing);

  return rows.map((row) => {
    const key = duplicateKey(row.type, row.amount, row.date);
    const count = left.get(key) ?? 0;
    if (count === 0) return false;

    left.set(key, count - 1);
    return true;
  });
}
