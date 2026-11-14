import type { Database } from "@/types/database";

/** A category as the client screens see it. */
export type CategoryView = {
  id: string;
  name: string;
  kind: Database["public"]["Enums"]["category_kind"];
  icon: string | null;
  color: string | null;
  archived: boolean;
  /** Transactions, budgets and rules pointing at it — zero means deletable. */
  usageCount: number;
  transactionCount: number;
};
