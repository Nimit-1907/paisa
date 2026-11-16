import { describe, expect, it } from "vitest";

import {
  guessAccounts,
  type LastAccounts,
  NO_LAST_ACCOUNTS,
} from "./entry-account";

const empty = { accountId: "", toAccountId: "" };

function guess(
  type: "expense" | "income" | "transfer",
  last: Partial<LastAccounts>,
  activeAccountIds: string[],
  { current = empty, chosenByHand = false } = {},
) {
  return guessAccounts({
    type,
    last: { ...NO_LAST_ACCOUNTS, ...last },
    activeAccountIds,
    current,
    chosenByHand,
  });
}

describe("guessAccounts", () => {
  it("uses the last account for the type", () => {
    expect(guess("expense", { expense: "card" }, ["bank", "card"])).toEqual({
      accountId: "card",
      toAccountId: "",
    });
  });

  it("falls back to the first active account when the type has no history", () => {
    expect(guess("income", { expense: "card" }, ["bank", "card"])).toEqual({
      accountId: "bank",
      toAccountId: "",
    });
  });

  it("ignores a last account that is no longer active", () => {
    expect(guess("expense", { expense: "old" }, ["bank"])).toEqual({
      accountId: "bank",
      toAccountId: "",
    });
  });

  it("guesses both ends of a transfer", () => {
    expect(
      guess("transfer", { transfer: "bank", transferTo: "wallet" }, [
        "bank",
        "wallet",
      ]),
    ).toEqual({ accountId: "bank", toAccountId: "wallet" });
  });

  it("never makes To the same as From", () => {
    expect(guess("transfer", {}, ["bank", "card"])).toEqual({
      accountId: "bank",
      toAccountId: "card",
    });
    expect(guess("transfer", {}, ["bank"])).toEqual({
      accountId: "bank",
      toAccountId: "",
    });
    expect(
      guess("transfer", { transfer: "bank", transferTo: "bank" }, [
        "bank",
        "card",
      ]),
    ).toEqual({ accountId: "bank", toAccountId: "card" });
  });

  it("keeps what the person chose", () => {
    const current = { accountId: "card", toAccountId: "" };
    for (const type of ["expense", "income", "transfer"] as const) {
      expect(
        guess(
          type,
          { expense: "bank", income: "bank", transfer: "bank" },
          ["bank", "card"],
          { current, chosenByHand: true },
        ),
      ).toEqual(current);
    }
  });

  it("leaves an empty account list empty", () => {
    expect(guess("expense", { expense: "card" }, [])).toEqual(empty);
  });
});
