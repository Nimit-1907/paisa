import type {
  AccountOption,
  CategoryOption,
} from "@/components/shared/entry-pickers";

/**
 * Database rows into picker options.
 *
 * Four screens hand accounts and categories to the same two pickers, and each
 * was writing the same map by hand. Doing it here means a new field — an
 * emoji, a short name — is added once rather than found in four places.
 */

type AccountRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type CategoryRow = AccountRow & { kind: "income" | "expense" };

export function toAccountOptions(rows: AccountRow[]): AccountOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
  }));
}

export function toCategoryOptions(rows: CategoryRow[]): CategoryOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    kind: row.kind,
  }));
}
