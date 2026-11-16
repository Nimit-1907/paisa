/**
 * Which account a new record starts on.
 *
 * Client-safe on purpose: the Add Record sheet runs it, and the query that
 * fills `LastAccounts` (lib/queries/accounts.ts) is server-only.
 */

/**
 * The account each kind of record last used, and a transfer's other end.
 * Null where that type has no record yet, or its account was archived.
 */
export type LastAccounts = {
  expense: string | null;
  income: string | null;
  transfer: string | null;
  transferTo: string | null;
};

export const NO_LAST_ACCOUNTS: LastAccounts = {
  expense: null,
  income: null,
  transfer: null,
  transferTo: null,
};
