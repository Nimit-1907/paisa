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

type Accounts = { accountId: string; toAccountId: string };

/**
 * The account (and a transfer's other end) a new record starts on.
 *
 * The account this type last used, if it is still open; otherwise the
 * first open account. A transfer's To is the last transfer's To, or the
 * next open account, and never the same as From. Whatever the person
 * picked themselves, or a quick-add chip filled in, is returned as it is:
 * a guess never overrides a choice.
 */
export function guessAccounts({
  type,
  last,
  activeAccountIds,
  current,
  chosenByHand,
}: {
  type: "expense" | "income" | "transfer";
  last: LastAccounts;
  activeAccountIds: string[];
  current: Accounts;
  chosenByHand: boolean;
}): Accounts {
  if (chosenByHand) return current;

  const open = (id: string | null) =>
    id !== null && activeAccountIds.includes(id) ? id : null;

  const accountId = open(last[type]) ?? activeAccountIds[0] ?? "";
  if (type !== "transfer") return { accountId, toAccountId: "" };

  const lastTo = open(last.transferTo);
  const toAccountId =
    (lastTo !== accountId ? lastTo : null) ??
    activeAccountIds.find((id) => id !== accountId) ??
    "";

  return { accountId, toAccountId };
}

/**
 * A transfer's accounts after the person picks From.
 *
 * With both ends pre-selected, picking the To account as the new From is
 * how someone reverses the last transfer. Left alone, To would still hold
 * that account while its picker hid it, and Save would refuse a transfer
 * into itself with an error on a field that looks empty. So it swaps: the
 * old From becomes To, or, with no From to swap in, the next open account.
 */
export function chooseFrom(
  id: string,
  current: Accounts,
  activeAccountIds: string[],
): Accounts {
  if (id !== current.toAccountId) {
    return { accountId: id, toAccountId: current.toAccountId };
  }

  const toAccountId =
    (current.accountId && current.accountId !== id
      ? current.accountId
      : null) ??
    activeAccountIds.find((other) => other !== id) ??
    "";

  return { accountId: id, toAccountId };
}
