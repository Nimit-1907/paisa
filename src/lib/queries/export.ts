import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fromDb } from "@/lib/money";
import type { Database } from "@/types/database";

export type ExportRow = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  /** Minor units. */
  amount: bigint;
  note: string | null;
  occurredAt: string;
  categoryName: string | null;
  accountName: string;
  toAccountName: string | null;
};

const SELECT = `
  id, type, amount, note, occurred_at,
  category:categories(name),
  account:accounts!transactions_account_id_fkey(name),
  to_account:accounts!transactions_to_account_id_fkey(name)
`;

type JoinedRow = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: number;
  note: string | null;
  occurred_at: string;
  category: { name: string } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
};

/** How many rows one round trip fetches while streaming an export. */
export const EXPORT_PAGE_SIZE = 500;

/**
 * One page of records for an export, oldest first.
 *
 * Oldest first because a statement reads forwards, and paged because an
 * export can cover years: holding every row of a long history in memory to
 * build one string is how a route handler runs a server out of it.
 */
export async function getExportPage({
  client,
  startsAt,
  endsAt,
  offset,
  limit = EXPORT_PAGE_SIZE,
}: {
  /**
   * Passed in rather than created here.
   *
   * The CSV route reads pages from inside a ReadableStream's `pull`, which
   * runs after the response has detached from the request, and
   * `createClient()` reads cookies, which are only there while the request
   * is. Building it once in the handler keeps the paging usable from the
   * stream.
   */
  client: SupabaseClient<Database>;
  /** Inclusive ISO instant. */
  startsAt: string;
  /** Exclusive ISO instant. */
  endsAt: string;
  offset: number;
  limit?: number;
}): Promise<ExportRow[]> {
  const supabase = client;

  const { data, error } = await supabase
    .from("transactions")
    .select(SELECT)
    .gte("occurred_at", startsAt)
    .lt("occurred_at", endsAt)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return (data as unknown as JoinedRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    amount: fromDb(row.amount),
    note: row.note,
    occurredAt: row.occurred_at,
    categoryName: row.category?.name ?? null,
    accountName: row.account?.name ?? "Account",
    toAccountName: row.to_account?.name ?? null,
  }));
}

/** Every record in the range, for a report that has to lay them all out. */
export async function getAllExportRows(
  client: SupabaseClient<Database>,
  startsAt: string,
  endsAt: string,
  limit = 5000,
): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];

  while (rows.length < limit) {
    const page = await getExportPage({
      client,
      startsAt,
      endsAt,
      offset: rows.length,
      limit: Math.min(EXPORT_PAGE_SIZE, limit - rows.length),
    });

    rows.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) break;
  }

  return rows;
}
