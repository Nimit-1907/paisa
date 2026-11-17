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
  /** One of the eight Phase 14 tint keys. */
  categoryTint: string | null;
  /** Set when a recurring rule created this row. */
  recurringRuleId: string | null;
  /**
   * How often that rule runs, so the detail can say "Repeats monthly"
   * rather than "Repeats".
   */
  recurringFrequency:
    Database["public"]["Enums"]["recurrence_frequency"] | null;
  /** "Worth it?" on a spend: true, false (a regret), or null, not said. */
  worthIt: boolean | null;
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
  id, type, amount, note, occurred_at, recurring_rule_id, worth_it,
  account_id, to_account_id, category_id,
  category:categories(name, icon, tint),
  rule:recurring_rules(frequency),
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
  worth_it: boolean | null;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  category: {
    name: string;
    icon: string | null;
    tint: string | null;
  } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
  rule: {
    frequency: Database["public"]["Enums"]["recurrence_frequency"];
  } | null;
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
    categoryTint: row.category?.tint ?? null,
    recurringRuleId: row.recurring_rule_id,
    recurringFrequency: row.rule?.frequency ?? null,
    worthIt: row.worth_it,
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
 * Offset paging rather than a keyset cursor: a month is a bounded set, a few
 * hundred rows at most, and a cursor built from a timestamp would have to be
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
      // Either leg, an account's history includes transfers into it.
      query = query.or(
        `account_id.in.(${ids.join(",")}),to_account_id.in.(${ids.join(",")})`,
      );
    }
  }

  if (filters?.categoryIds?.length) {
    query = query.in("category_id", filters.categoryIds);
  }

  if (filters?.worth) {
    query = query.eq("worth_it", filters.worth === "worth");
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

/** How many results one search returns before it asks for a narrower term. */
export const SEARCH_LIMIT = 100;

export type SearchResult = {
  rows: TransactionRow[];
  /** How many records match, which can be more than `rows.length`. */
  matchCount: number;
  /** True when the limit was hit and there is more behind it. */
  hasMore: boolean;
  /** Totals over **every** match, not only the rows that came back. */
  income: bigint;
  expense: bigint;
};

/**
 * Every record whose note matches, newest first, across every month.
 *
 * Deliberately not month-scoped, unlike {@link getMonthTransactions}. The
 * month is how this app is *read*, the switcher, the card, the totals, but
 * it is not how anybody searches: "rent" within November alone is a question
 * with an obvious answer, and the one worth asking is when the rent went up.
 *
 * Capped rather than paged. A search that returns more than a hundred rows
 * is a search term that is not narrow enough, and saying so is more useful
 * than an infinite scroll through three years of groceries.
 */
export async function searchTransactions(term: string): Promise<SearchResult> {
  const trimmed = term.trim();
  if (!trimmed) {
    return { rows: [], matchCount: 0, hasMore: false, income: 0n, expense: 0n };
  }

  const supabase = await createClient();

  // Escape the wildcards a user can type, so they search literally. Done
  // once, here, and handed to the totals function as well, two copies of
  // this would be two opinions about what a literal `%` means. The pg_trgm
  // GIN index on note is what keeps both halves fast.
  const pattern = trimmed.replace(/[%_\\]/g, (match) => `\\${match}`);

  // The rows are capped; the totals are not. Summing the hundred rows that
  // came back and calling it the total is wrong by whatever is behind the
  // cap, and wrong in the direction that reassures.
  const [page, totals] = await Promise.all([
    supabase
      .from("transactions")
      .select(SELECT)
      .ilike("note", `%${pattern}%`)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, SEARCH_LIMIT),
    supabase.rpc("search_totals", { p_pattern: pattern }).maybeSingle(),
  ]);

  if (page.error) throw new Error(page.error.message);
  if (totals.error) throw new Error(totals.error.message);

  const joined = page.data as unknown as JoinedRow[];
  const hasMore = joined.length > SEARCH_LIMIT;

  return {
    rows: joined.slice(0, SEARCH_LIMIT).map(toRow),
    matchCount: totals.data?.match_count ?? joined.length,
    hasMore,
    // A transfer counts for neither: it moves money between the user's own
    // accounts, and counting it would make a search for "transfer" look
    // like income.
    income: fromDb(totals.data?.income ?? 0),
    expense: fromDb(totals.data?.expense ?? 0),
  };
}

/** Income, expense and net for a month, the summary strip. */
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

/**
 * What was regretted in a month, in minor units: the spends marked "not
 * worth it". Zero when none are.
 */
export async function getMonthRegret(
  year: number,
  month: number,
): Promise<bigint> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("month_regret", {
    p_month: `${year}-${String(month).padStart(2, "0")}-01`,
  });

  if (error) throw new Error(error.message);
  return fromDb(data ?? 0);
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

/**
 * What went out on each day of a month, including the days nothing did.
 *
 * Feeds the bars on the month card. `period_series` generates a row per
 * bucket in the range, so a quiet Sunday comes back as a zero rather than as
 * a gap, which is what lets the card draw a calendar rather than a list of
 * the days that happened to have something on them.
 */
export async function getMonthDays(
  year: number,
  month: number,
): Promise<{ on: string; expense: string }[]> {
  const supabase = await createClient();

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  const { data, error } = await supabase.rpc("period_series", {
    p_from: from,
    p_to: to,
    p_bucket: "day",
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    on: row.bucket_start,
    expense: fromDb(row.expense).toString(),
  }));
}

/**
 * How many records there are in all, and the span they cover.
 *
 * For the Export screen's summary: "1,284 records · Sept 2024 – Nov 2026".
 *
 * All three ride `transactions_user_occurred_idx (user_id, occurred_at desc)`
 * from the initial schema: the count is an index-only scan of this user's
 * slice, and each date is the first row off one end of it, a btree reads
 * in either direction, so the ascending one costs no sort.
 */
// rubric:allow PERF-MISSING-INDEX the index is in 20261114120000_initial_schema.sql
export async function getRecordsSpan(): Promise<{
  count: number;
  first: string | null;
  last: string | null;
}> {
  const supabase = await createClient();

  const [total, earliest, latest] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase
      .from("transactions")
      .select("occurred_at")
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // All three, not only the count: a failed head read would hand back a
  // null date, and "86 records · Nothing logged yet" is a sentence that
  // argues with itself. The page catches this and drops the summary line.
  if (total.error) throw new Error(total.error.message);
  if (earliest.error) throw new Error(earliest.error.message);
  if (latest.error) throw new Error(latest.error.message);

  return {
    count: total.count ?? 0,
    first: earliest.data?.occurred_at ?? null,
    last: latest.data?.occurred_at ?? null,
  };
}
