import type { TransactionRow } from "@/lib/queries/transactions";

export type MonthGroup = {
  /** `yyyy-mm` in the user's own timezone. */
  key: string;
  /** "November 2026". */
  label: string;
  rows: TransactionRow[];
  /** Income minus expense over the rows in this group. */
  net: bigint;
};

/**
 * Search results into months, in the order they arrived.
 *
 * The month is the user's, not UTC's: a record logged at 00:30 on the first
 * belongs to the month they were living in, which is what every other total
 * in this app agrees on. Insertion order is kept rather than sorted, because
 * the rows come back newest first and that is the order to read them in.
 *
 * A transfer counts for nothing in the net. It moves money between the
 * user's own accounts, and counting it would make a search for "transfer"
 * look like income.
 */
export function groupByMonth(
  rows: TransactionRow[],
  timeZone: string,
): MonthGroup[] {
  const keyOf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });
  const labelOf = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    month: "long",
    year: "numeric",
  });

  const groups = new Map<string, MonthGroup>();

  for (const row of rows) {
    const when = new Date(row.occurredAt);
    const key = keyOf.format(when);

    let group = groups.get(key);
    if (!group) {
      group = { key, label: labelOf.format(when), rows: [], net: 0n };
      groups.set(key, group);
    }

    group.rows.push(row);
    if (row.type === "income") group.net += BigInt(row.amount);
    if (row.type === "expense") group.net -= BigInt(row.amount);
  }

  return [...groups.values()];
}
