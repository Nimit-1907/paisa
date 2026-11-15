import { describe, expect, it } from "vitest";

import { balanceAfterTransfer } from "./overdraw";

describe("balanceAfterTransfer", () => {
  it("subtracts a new transfer from the balance", () => {
    expect(
      balanceAfterTransfer({ balance: 10_000n, amount: 2_500n, original: null }),
    ).toBe(7_500n);
  });

  it("goes negative when there is not enough", () => {
    expect(
      balanceAfterTransfer({ balance: 1_000n, amount: 2_500n, original: null }),
    ).toBe(-1_500n);
  });

  it("does not count an edited transfer twice", () => {
    // An account held 10,000; a transfer of 10,000 left it at 0. Opening
    // that transfer and changing nothing must read as 0, not -10,000.
    expect(
      balanceAfterTransfer({ balance: 0n, amount: 10_000n, original: 10_000n }),
    ).toBe(0n);
  });

  it("measures an edit against what the account would hold without it", () => {
    // Same transfer, raised to 12,000: the account only ever had 10,000.
    expect(
      balanceAfterTransfer({ balance: 0n, amount: 12_000n, original: 10_000n }),
    ).toBe(-2_000n);

    // And lowered to 4,000: 6,000 comes back.
    expect(
      balanceAfterTransfer({ balance: 0n, amount: 4_000n, original: 10_000n }),
    ).toBe(6_000n);
  });

  it("treats a moved transfer as new to the account it moved to", () => {
    // The From account was changed, so this account never felt the old
    // amount and there is nothing to put back.
    expect(
      balanceAfterTransfer({ balance: 5_000n, amount: 1_000n, original: null }),
    ).toBe(4_000n);
  });

  it("handles an account that is already negative", () => {
    // A credit card. Nothing special happens; it just gets more negative.
    expect(
      balanceAfterTransfer({ balance: -2_000n, amount: 500n, original: null }),
    ).toBe(-2_500n);
  });

  it("is exact past Number.MAX_SAFE_INTEGER", () => {
    expect(
      balanceAfterTransfer({
        balance: 9_007_199_254_740_993n,
        amount: 1n,
        original: null,
      }),
    ).toBe(9_007_199_254_740_992n);
  });
});
