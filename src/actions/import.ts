"use server";

import { revalidatePath } from "next/cache";

import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { localToInstant } from "@/lib/dates";
import type { KeywordMap } from "@/lib/import/category-guess";
import { countKeys, markDuplicates } from "@/lib/import/duplicates";
import { toDb } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import {
  TooManyExistingRecords,
  getExistingKeys,
  getKeywordMap,
} from "@/lib/queries/import";
import {
  type ExistingRecordsInput,
  type ImportRecordsInput,
  existingRecordsSchema,
  importRecordsSchema,
} from "@/lib/schemas/import";
import { createClient } from "@/lib/supabase/server";

/**
 * The time of day an imported record is placed at.
 *
 * A statement row has a day and no time. Midday rather than midnight, so the
 * record stays on its day if the person later moves their profile a few
 * timezones either way.
 */
const IMPORTED_TIME = "12:00";

const TOO_MANY =
  "That account has too many records in this stretch to check. Import a shorter stretch of dates at a time.";

async function timeZoneOf(): Promise<string> {
  const profile = await getProfile();
  return profile?.timezone ?? DEFAULT_TIME_ZONE;
}

/** Whether the account is the caller's and still open. */
async function openAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
): Promise<ActionResult<undefined>> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .eq("archived", false)
    .maybeSingle();

  if (error) return failFromDb(error, "Could not check that account.");
  if (!data) return fail("Choose one of your open accounts.", "accountId");
  return ok(undefined);
}

/**
 * Duplicate keys the account already has between two days.
 *
 * What the preview marks rows with. The import checks again on its own:
 * a record added in another tab between the preview and the import must
 * still not be booked twice.
 */
export async function findExistingRecords(
  input: ExistingRecordsInput,
): Promise<ActionResult<{ keys: string[] }>> {
  const parsed = parseInput(existingRecordsSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const account = await openAccount(supabase, user.id, parsed.data.accountId);
  if (!account.ok) return account;

  try {
    const keys = await getExistingKeys(supabase, {
      ...parsed.data,
      timeZone: await timeZoneOf(),
    });
    return ok({ keys });
  } catch (thrown) {
    if (thrown instanceof TooManyExistingRecords) return fail(TOO_MANY);
    console.error("[import]", thrown);
    return fail("Could not check for duplicates.");
  }
}

/**
 * Keyword → category from the last twelve months, for the guesses.
 *
 * Asked for once a file has been chosen rather than on every visit to the
 * screen: it reads up to 5,000 records, which nobody who only opened Import
 * to look at it should wait for.
 */
export async function getCategoryGuesses(): Promise<ActionResult<KeywordMap>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false);

  if (error) return failFromDb(error, "Could not read your categories.");

  try {
    return ok(
      await getKeywordMap(
        supabase,
        await timeZoneOf(),
        new Set(categories.map((category) => category.id)),
      ),
    );
  } catch (thrown) {
    console.error("[import]", thrown);
    return fail("Could not read your history for category guesses.");
  }
}

export type ImportResult = {
  imported: number;
  /** Rows sent that an existing record cancelled. */
  skipped: number;
};

/**
 * Books the previewed rows, in one insert.
 *
 * Everything the browser decided is checked again here: the account is the
 * caller's and open, every category is the caller's, open, and of the
 * row's own type, and each record the account already has cancels one
 * matching row. RLS stands behind all of it.
 */
export async function importRecords(
  input: ImportRecordsInput,
): Promise<ActionResult<ImportResult>> {
  const parsed = parseInput(importRecordsSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { accountId, rows } = parsed.data;

  const account = await openAccount(supabase, user.id, accountId);
  if (!account.ok) return account;

  const categoryIds = [
    ...new Set(
      rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])),
    ),
  ];
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, kind")
    .in("id", categoryIds)
    .eq("user_id", user.id)
    .eq("archived", false);

  if (categoriesError) {
    return failFromDb(categoriesError, "Could not check the categories.");
  }

  const kindById = new Map(categories.map((row) => [row.id, row.kind]));
  if (
    rows.some(
      (row) => row.categoryId && kindById.get(row.categoryId) !== row.type,
    )
  ) {
    return fail(
      "A category is no longer available for its rows. Pick it again.",
      "categoryId",
    );
  }

  const timeZone = await timeZoneOf();
  const dates = rows.map((row) => row.date).sort();
  const candidates = rows.map((row) => ({ ...row, amount: BigInt(row.amount) }));

  let existing: Map<string, number>;
  try {
    existing = countKeys(
      await getExistingKeys(supabase, {
      accountId,
      from: dates[0],
      to: dates[dates.length - 1],
        timeZone,
      }),
    );
  } catch (thrown) {
    if (thrown instanceof TooManyExistingRecords) return fail(TOO_MANY);
    console.error("[import]", thrown);
    return fail("Could not check for duplicates, so nothing was imported.");
  }

  // The authority on duplicates. The preview sends every row, its own
  // duplicates included, so this count sees the whole file: each record
  // the account has cancels one row, and identical rows are each a record.
  const duplicates = markDuplicates(candidates, existing);
  const fresh = candidates.filter((_, index) => !duplicates[index]);

  const inserts = [];
  for (const row of fresh) {
    // Only a row the preview took for a duplicate may come without a
    // category; if it is not one now (that record was deleted meanwhile),
    // it needs one before it can be booked.
    if (!row.categoryId) {
      return fail(
        "A row the preview counted as a duplicate is new now. Choose the file again.",
        "categoryId",
      );
    }

    const instant = localToInstant(`${row.date}T${IMPORTED_TIME}`, timeZone);
    if (!instant) return fail("A date could not be placed in your timezone.");

    inserts.push({
      user_id: user.id,
      type: row.type,
      amount: toDb(row.amount),
      account_id: accountId,
      category_id: row.categoryId,
      note: row.note || null,
      occurred_at: instant.toISOString(),
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("transactions").insert(inserts);
    if (error) return failFromDb(error, "Could not import those records.");

    revalidatePath("/records");
    revalidatePath("/analysis");
    revalidatePath("/budgets");
    revalidatePath("/accounts");
  }

  return ok({
    imported: inserts.length,
    skipped: rows.length - inserts.length,
  });
}
