import type { Database } from "@/types/database";

/** A category as the client screens see it. */
export type CategoryView = {
  id: string;
  name: string;
  kind: Database["public"]["Enums"]["category_kind"];
  icon: string | null;
  /** One of the eight Phase 14 tint keys. */
  tint: string | null;
  archived: boolean;
  /** Transactions, budgets and rules pointing at it, zero means deletable. */
  usageCount: number;
  transactionCount: number;
  /**
   * What this category has come to this month, in minor units as text.
   *
   * "0" for a category with nothing against it, and **null** when the
   * lookup failed, which is not the same thing. The grid shows ₹0 for
   * zero and nothing at all for null, because "you spent nothing on Food"
   * is a claim and a failed query has not earned it.
   */
  monthTotal: string | null;
};
