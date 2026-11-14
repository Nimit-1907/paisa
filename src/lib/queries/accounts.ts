import "server-only";

import { fromDb } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * PostgREST's `.or()` takes a filter *string*, so an id that is not a uuid
 * could rewrite the filter rather than be matched by it. Ids reach these
 * functions straight from the URL, so they are checked before they are
 * spliced into one.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function assertUuid(value: string): string {
  if (!isUuid(value)) {
    throw new Error("Not a valid id");
  }
  return value;
}

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

export type AccountWithBalance = AccountRow & {
  balance: bigint;
  /** Transactions and recurring rules pointing at this account. */
  usageCount: number;
};

/**
 * Every account with its balance and whether anything depends on it.
 *
 * Three cheap reads rather than one clever join: PostgREST cannot join a view
 * to a view, and merging by id here keeps each query trivially indexable.
 */
export async function getAccountsOverview(): Promise<AccountWithBalance[]> {
  const supabase = await createClient();

  const [accounts, balances, usage] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("account_balances").select("account_id, balance"),
    supabase
      .from("account_usage")
      .select("account_id, transaction_count, recurring_rule_count"),
  ]);

  if (accounts.error) throw new Error(accounts.error.message);
  if (balances.error) throw new Error(balances.error.message);
  if (usage.error) throw new Error(usage.error.message);

  const balanceById = new Map(
    balances.data.map((row) => [row.account_id, row.balance ?? 0]),
  );
  const usageById = new Map(
    usage.data.map((row) => [
      row.account_id,
      (row.transaction_count ?? 0) + (row.recurring_rule_count ?? 0),
    ]),
  );

  return accounts.data.map((account) => ({
    ...account,
    // fromDb, not BigInt(): PostgREST hands back a JS number for a bigint
    // column, and BigInt() throws on anything fractional or unsafe.
    balance: fromDb(balanceById.get(account.id) ?? account.initial_balance),
    usageCount: usageById.get(account.id) ?? 0,
  }));
}

/** One account, or null when it is not the caller's. */
export async function getAccount(id: string) {
  assertUuid(id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getAccountBalance(id: string): Promise<bigint> {
  assertUuid(id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return fromDb(data?.balance ?? 0);
}

export type AccountTransaction = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: bigint;
  note: string | null;
  occurredAt: string;
  /** Positive when the money came in, negative when it left. */
  signedAmount: bigint;
  counterparty: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
};

type TransactionJoinRow = {
  id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: number;
  note: string | null;
  occurred_at: string;
  account_id: string;
  to_account_id: string | null;
  category: { name: string; icon: string | null; color: string | null } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
};

/**
 * An account's records, newest first — both legs of a transfer included.
 *
 * The sign is worked out here rather than in the view: "did this account gain
 * or lose money" depends on which side of a transfer it is on.
 */
export async function getAccountTransactions(
  accountId: string,
  limit = 50,
): Promise<AccountTransaction[]> {
  assertUuid(accountId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      `id, type, amount, note, occurred_at, account_id, to_account_id,
       category:categories(name, icon, color),
       account:accounts!transactions_account_id_fkey(name),
       to_account:accounts!transactions_to_account_id_fkey(name)`,
    )
    .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data as unknown as TransactionJoinRow[]).map((row) => {
    const incoming =
      row.type === "income" ||
      (row.type === "transfer" && row.to_account_id === accountId);

    const amount = fromDb(row.amount);

    return {
      id: row.id,
      type: row.type,
      amount,
      note: row.note,
      occurredAt: row.occurred_at,
      signedAmount: incoming ? amount : -amount,
      counterparty:
        row.type === "transfer"
          ? row.to_account_id === accountId
            ? (row.account?.name ?? null)
            : (row.to_account?.name ?? null)
          : null,
      categoryName: row.category?.name ?? null,
      categoryIcon: row.category?.icon ?? null,
      categoryColor: row.category?.color ?? null,
    };
  });
}

/**
 * Money in and out of one account during a month.
 *
 * Summed by the database: fetching the rows to add them up here would pull a
 * whole month of a busy account into memory on every render.
 */
export async function getAccountMonthFlow(
  accountId: string,
  month: string,
): Promise<{ moneyIn: bigint; moneyOut: bigint }> {
  assertUuid(accountId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("account_month_flow", { p_account_id: accountId, p_month: month })
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    moneyIn: fromDb(data?.money_in ?? 0),
    moneyOut: fromDb(data?.money_out ?? 0),
  };
}

/**
 * The accounts a picker may offer — archived ones excluded.
 *
 * An archived account keeps showing on the records that already reference it;
 * it just cannot be chosen for a new one.
 */
export async function getActiveAccounts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

/** The four buckets `entry_defaults()` sorts the day into. */
export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

const PARTS_OF_DAY: PartOfDay[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
];

export type EntryDefaults = {
  /** The account the last record was booked against, if it still exists. */
  lastAccountId: string | null;
  /** Categories usually picked at this time of day, most likely first. */
  suggestedCategoryIds: string[];
  /**
   * Which part of the day those categories were drawn from.
   *
   * Decided in the database, in the profile's timezone, so the label above
   * the row cannot disagree with the row — which is what reading the
   * device's own clock would do the moment somebody travelled.
   */
  partOfDay: PartOfDay;
};

/**
 * What the Add Record sheet can know before it is opened.
 *
 * Worked out from the records rather than remembered on the device: a
 * preference in localStorage is wrong the moment someone picks up their other
 * phone, and it is empty on the first one.
 */
export async function getEntryDefaults(): Promise<EntryDefaults> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("entry_defaults");

  // Never fatal: the sheet opens with its old defaults, which is a worse
  // guess rather than a broken screen.
  if (error) {
    console.error("[records]", error.message);
    return { lastAccountId: null, suggestedCategoryIds: [], partOfDay: "night" };
  }

  const value = (data ?? {}) as {
    lastAccountId?: string | null;
    suggestedCategoryIds?: string[];
    partOfDay?: string;
  };

  const partOfDay = PARTS_OF_DAY.find((part) => part === value.partOfDay);

  return {
    lastAccountId: value.lastAccountId ?? null,
    suggestedCategoryIds: (value.suggestedCategoryIds ?? []).filter(isUuid),
    partOfDay: partOfDay ?? "night",
  };
}
