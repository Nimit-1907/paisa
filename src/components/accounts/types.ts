import type { Database } from "@/types/database";

/**
 * An account as the client screens see it.
 *
 * Amounts cross the server/client boundary as minor-unit strings: the RSC
 * payload is JSON, which has no BigInt, and a plain number would quietly
 * become a float. The client turns them back with BigInt() before formatting.
 */
export type AccountView = {
  id: string;
  name: string;
  type: Database["public"]["Enums"]["account_type"];
  icon: string | null;
  /** One of the eight Phase 14 tint keys. */
  tint: string | null;
  initialBalance: string;
  balance: string;
  includeInTotal: boolean;
  archived: boolean;
  usageCount: number;
};
