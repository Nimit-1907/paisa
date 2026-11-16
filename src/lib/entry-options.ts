import type {
  AccountOption,
  CategoryOption,
} from "@/components/shared/entry-pickers";

/**
 * Database rows into picker options.
 *
 * Four screens hand accounts and categories to the same two pickers, and each
 * was writing the same map by hand. Doing it here means a new field, an
 * emoji, a short name, is added once rather than found in four places.
 */

type AccountRow = {
  id: string;
  name: string;
  icon: string | null;
  tint?: string | null;
  /** Present on the full account view; absent on a bare picker row. */
  balance?: bigint | string | null;
};

type CategoryRow = AccountRow & { kind: "income" | "expense" };

/**
 * `withBalances` is opt-in, and three of the four callers do not opt in.
 *
 * Only the transfer sheet reads a balance, to warn when money is being moved
 * out of an account that has not got it. The filter sheet and the two
 * recurring sheets show the same accounts and never mention a figure, so
 * without this flag they would each ship every account's balance into the
 * browser to be ignored. It is the user's own data either way, but data that
 * nothing on the page can use has no business being on the page.
 */
export function toAccountOptions(
  rows: AccountRow[],
  { withBalances = false }: { withBalances?: boolean } = {},
): AccountOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    tint: row.tint ?? null,
    // Normalised to text here rather than at the call site: a BigInt cannot
    // cross the RSC boundary, and `undefined` and `null` mean the same thing
    // to the one component that reads this.
    balance:
      withBalances && row.balance !== undefined && row.balance !== null
        ? row.balance.toString()
        : null,
  }));
}

export function toCategoryOptions(rows: CategoryRow[]): CategoryOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    tint: row.tint ?? null,
    kind: row.kind,
  }));
}
