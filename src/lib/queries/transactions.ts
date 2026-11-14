import "server-only";

import { localToInstant, monthRange } from "@/lib/dates";
import { fromDb, toDb, tryToMinor } from "@/lib/money";
import type { TransactionFilters } from "@/lib/schemas/transactions";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type TransactionRow = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  /** Always positive; the sign belongs to the type. Minor units as text. */
  amount: string;
  note: string | null;
  occurredAt: string;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  /** Set when a recurring rule created this row. */
  recurringRuleId: string | null;
};

export type TransactionPage = {
  rows: TransactionRow[];
  hasMore: boolean;
  nextOffset: number;
};

export const PAGE_SIZE = 40;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT = `
  id, type, amount, note, occurred_at, recurring_rule_id,
  account_id, to_account_id, category_id,
  category:categories(name, icon, color),
  account:accounts!transactions_account_id_fkey(name),
  to_account:accounts!transactions_to_account_id_fkey(name)
`;

type JoinedRow = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: number;
  note: string | null;
  occurred_at: string;
  recurring_rule_id: string | null;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  category: { name: string; icon: string | null; color: string | null } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
};

function toRow(row: JoinedRow): TransactionRow {
  return {
    id: row.id,
    type: row.type,
    amount: fromDb(row.amount).toString(),
    note: row.note,
    occurredAt: row.occurred_at,
    accountId: row.account_id,
    accountName: row.account?.name ?? "Account",
    toAccountId: row.to_account_id,
    toAccountName: row.to_account?.name ?? null,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    categoryIcon: row.category?.icon ?? null,
    categoryColor: row.category?.color ?? null,
    recurringRuleId: row.recurring_rule_id,
  };
}

/** The `yyyy-mm-dd` after this one, on the calendar rather than the clock. */
function nextCalendarDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1))
    .toISOString()
    .slice(0, 10);
}

/** Local midnight at the start of a `yyyy-mm-dd`, as an instant. */
function dayStart(day: string, timeZone: string): string | null {
  return localToInstant(`${day}T00:00`, timeZone)?.toISOString() ?? null;
}

/**
 * One page of a month's records, newest first.
 *
 * Offset paging rather than a keyset cursor: a month is a bounded set — a few
 * hundred rows at most — and a cursor built from a timestamp would have to be
 * spliced into a PostgREST filter string, which is the shape that invites an
 * injection bug.
 *
 * One row more than the page is fetched; its presence is the answer to
 * "is there more to scroll?".
 */
export async function getMonthTransactions({
  year,
  month,
  timeZone,
  decimals,
  filters,
  offset = 0,
  limit = PAGE_SIZE,
}: {
  year: number;
  month: number;
  timeZone: string;
  decimals: number;
  filters?: TransactionFilters;
  offset?: number;
  limit?: number;
}): Promise<TransactionPage> {
  const supabase = await createClient();
  const range = monthRange(year, month, timeZone);

  let query = supabase
    .from("transactions")
    .select(SELECT)
    .gte("occurred_at", range.startsAt)
    .lt("occurred_at", range.endsAt);

  if (filters?.search) {
    // Escape the wildcards a user can type, so they search literally. The
    // pg_trgm GIN index on note is what keeps this fast.
    const pattern = filters.search.replace(/[%_\\]/g, (match) => `\\${match}`);
    query = query.ilike("note", `%${pattern}%`);
  }

  if (filters?.types?.length) {
    query = query.in("type", filters.types);
  }

  if (filters?.accountIds?.length) {
    // Checked again here, not only in the schema: these are interpolated into
    // a PostgREST filter string, which a non-uuid could rewrite.
    const ids = filters.accountIds.filter((id) => UUID.test(id));
    if (ids.length) {
      // Either leg — an account's history includes transfers into it.
      query = query.or(
        `account_id.in.(${ids.join(",")}),to_account_id.in.(${ids.join(",")})`,
      );
    }
  }

  if (filters?.categoryIds?.length) {
    query = query.in("category_id", filters.categoryIds);
  }

  const min = filters?.minAmount
    ? tryToMinor(filters.minAmount, decimals)
    : null;
  if (min !== null) query = query.gte("amount", toDb(min));

  const max = filters?.maxAmount
    ? tryToMinor(filters.maxAmount, decimals)
    : null;
  if (max !== null) query = query.lte("amount", toDb(max));

  if (filters?.from) {
    const from = dayStart(filters.from, timeZone);
    if (from) query = query.gte("occurred_at", from);
  }

  if (filters?.to) {
    // Inclusive of the chosen day: everything before the *next day's* local
    // midnight. Adding 24 hours to an instant instead would land an hour out
    // on a daylight-saving day, which is 23 or 25 hours long.
    const next = dayStart(nextCalendarDay(filters.to), timeZone);
    if (next) query = query.lt("occurred_at", next);
  }

  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (error) throw new Error(error.message);

  const rows = data as unknown as JoinedRow[];
  const hasMore = rows.length > limit;

  return {
    rows: rows.slice(0, limit).map(toRow),
    hasMore,
    nextOffset: offset + limit,
  };
}

/** Income, expense and net for a month — the summary strip. */
export async function getMonthSummary(
  year: number,
  month: number,
): Promise<{ income: bigint; expense: bigint; net: bigint }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("month_summary", {
      p_month: `${year}-${String(month).padStart(2, "0")}-01`,
    })
    .maybeSingle();

  if (error) throw new Error(error.message);

  const income = fromDb(data?.total_income ?? 0);
  const expense = fromDb(data?.total_expense ?? 0);

  return { income, expense, net: income - expense };
}

/** One record, for the edit sheet. */
export async function getTransaction(
  id: string,
): Promise<TransactionRow | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return toRow(data as unknown as JoinedRow);
}
