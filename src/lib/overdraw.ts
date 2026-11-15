/**
 * What a transfer leaves behind in the account it comes out of.
 *
 * Its own function with its own tests because the arithmetic has one trap in
 * it, and the trap is invisible on the screen that uses it.
 *
 * The balance handed in is the account's balance *now*. When a transfer is
 * being created, that balance has not felt it yet, so the answer is a plain
 * subtraction. When an existing transfer is being **edited**, the balance has
 * already had the old amount taken out of it — so subtracting the new amount
 * as well counts the same transfer twice. Opening a transfer that emptied an
 * account and changing nothing would announce "has ₹0, this takes it to
 * −₹100", which is both wrong and alarming.
 *
 * Putting the original amount back first is what makes editing arithmetic
 * agree with creating arithmetic.
 */
export function balanceAfterTransfer({
  balance,
  amount,
  original,
}: {
  /** The From account's balance right now, in minor units. */
  balance: bigint;
  /** The amount being transferred, in minor units. */
  amount: bigint;
  /**
   * The amount this transfer had before the edit, if it is an edit *and*
   * the From account has not been changed. Null otherwise — a transfer moved
   * to a different account never touched this one's balance.
   */
  original: bigint | null;
}): bigint {
  const restored = original === null ? balance : balance + original;
  return restored - amount;
}
