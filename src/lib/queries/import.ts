import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { instantToLocal, localToInstant, localToday } from "@/lib/dates";
import { type KeywordMap, buildKeywordMap } from "@/lib/import/category-guess";
import { duplicateKey } from "@/lib/import/duplicates";
import { fromDb } from "@/lib/money";
import { rangeToInstants } from "@/lib/schemas/export";
import type { Database } from "@/types/database";

/** PostgREST's `max_rows`: a page longer than this is silently cut short. */
const PAGE = 1000;

/**
 * The most an account's history is read for one duplicate check.
 *
 * A cap that fails loudly, not one that truncates: a check that stopped
 * reading at row 20,000 would let row 20,001 be imported a second time.
 */
const MAX_EXISTING = 20_000;

export class TooManyExistingRecords extends Error {
  constructor() {
    super("Too many existing records to compare against");
    this.name = "TooManyExistingRecords";
  }
}

/**
 * What the account already has between two local days, as duplicate keys
 * (type, amount, local date), one per record: a key appears as often as
 * the account has records like it, because each cancels one row. Expense and income only: an imported row is
 * never a transfer, so a transfer can never be its duplicate.
 */
export async function getExistingKeys(
  supabase: SupabaseClient<Database>,
  {
    accountId,
    from,
    to,
    timeZone,
  }: { accountId: string; from: string; to: string; timeZone: string },
): Promise<string[]> {
  const range = rangeToInstants({ from, to }, timeZone);
  if (!range) throw new Error("Could not place that range in the timezone");

  const keys: string[] = [];

  for (let offset = 0; ; offset += PAGE) {
    if (offset >= MAX_EXISTING) throw new TooManyExistingRecords();

    const { data, error } = await supabase
      .from("transactions")
      .select("id, type, amount, occurred_at")
      .eq("account_id", accountId)
      .in("type", ["expense", "income"])
      .gte("occurred_at", range.startsAt)
      .lt("occurred_at", range.endsAt)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(error.message);

    for (const row of data) {
      keys.push(
        duplicateKey(
          row.type,
          fromDb(row.amount),
          instantToLocal(row.occurred_at, timeZone).slice(0, 10),
        ),
      );
    }

    if (data.length < PAGE) break;
  }

  return keys;
}

/** How far back the category guess looks, and how much of it it reads. */
const HISTORY_PAGES = 5;

/**
 * The person's last twelve months of notes, as keyword → category.
 *
 * Newest first, so a tie goes to the more recent choice. Archived
 * categories are left out: a guess is a choice made for the person, and
 * those must not be chosen again.
 */
export async function getKeywordMap(
  supabase: SupabaseClient<Database>,
  timeZone: string,
  activeCategoryIds: ReadonlySet<string>,
): Promise<KeywordMap> {
  const [year, month, day] = localToday(timeZone).split("-").map(Number);
  // A year ago today; the 29th of February a year on is the 1st of March.
  const yearAgo = new Date(Date.UTC(year - 1, month - 1, day))
    .toISOString()
    .slice(0, 10);
  const since = localToInstant(`${yearAgo}T00:00`, timeZone);
  if (!since) return { expense: {}, income: {} };

  const history: { type: string; note: string | null; categoryId: string | null }[] = [];

  for (let page = 0; page < HISTORY_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, type, note, category_id, occurred_at")
      .in("type", ["expense", "income"])
      .not("note", "is", null)
      .not("category_id", "is", null)
      .gte("occurred_at", since.toISOString())
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    if (error) throw new Error(error.message);

    for (const row of data) {
      if (row.category_id && activeCategoryIds.has(row.category_id)) {
        history.push({ type: row.type, note: row.note, categoryId: row.category_id });
      }
    }

    if (data.length < PAGE) break;
  }

  return buildKeywordMap(history);
}
