import "server-only";

import { cache } from "react";

import {
  type Investment,
  type InvestmentEntry,
  type InvestmentGoal,
  scheduleToCadence,
} from "@/lib/investments";
import { isTint } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InvestmentRow = Database["public"]["Tables"]["investments"]["Row"];
type SummaryRow = Database["public"]["Views"]["investment_summary"]["Row"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isInvestmentId(value: string): boolean {
  return UUID.test(value);
}

function toInvestment(row: InvestmentRow, summary?: SummaryRow): Investment {
  const schedule =
    row.sched_amount !== null &&
    row.frequency !== null &&
    row.interval_count !== null &&
    row.start_date !== null &&
    row.next_run_on !== null &&
    (row.frequency === "monthly" || row.frequency === "yearly")
      ? {
          amount: row.sched_amount,
          cadence: scheduleToCadence(row.frequency, row.interval_count),
          frequency: row.frequency,
          interval: row.interval_count,
          startDate: row.start_date,
          anchorDay: row.anchor_day,
          endDate: row.end_date,
          installmentsTotal: row.installments_total,
          nextRunOn: row.next_run_on,
          paused: row.paused,
          skippedDates: row.skipped_dates ?? [],
        }
      : null;

  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    goalId: row.goal_id,
    platform: row.platform,
    folio: row.folio,
    note: row.note,
    status: row.status === "closed" ? "closed" : "open",
    closedOn: row.closed_on,
    interestRate: row.interest_rate,
    tenureMonths: row.tenure_months,
    maturityDate: row.maturity_date,
    maturityAmount: row.maturity_amount,
    schedule,
    invested: summary?.invested ?? 0,
    redeemed: summary?.redeemed ?? 0,
    net: summary?.net ?? 0,
    entryCount: summary?.entry_count ?? 0,
    lastEntryOn: summary?.last_entry_on ?? null,
  };
}

/** Every investment of the signed-in user, newest first, with its totals. */
export const getInvestments = cache(async (): Promise<Investment[]> => {
  const supabase = await createClient();

  const [investments, summaries] = await Promise.all([
    supabase
      .from("investments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("investment_summary").select("*"),
  ]);

  if (investments.error) throw new Error(investments.error.message);
  if (summaries.error) throw new Error(summaries.error.message);

  const byId = new Map(
    summaries.data.map((summary) => [summary.investment_id, summary]),
  );

  return investments.data.map((row) => toInvestment(row, byId.get(row.id)));
});

/** One investment with its totals, or null when it is not the user's. */
export async function getInvestment(id: string): Promise<Investment | null> {
  if (!isInvestmentId(id)) return null;

  const supabase = await createClient();

  const [investment, summary] = await Promise.all([
    supabase.from("investments").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("investment_summary")
      .select("*")
      .eq("investment_id", id)
      .maybeSingle(),
  ]);

  if (investment.error) throw new Error(investment.error.message);
  if (!investment.data) return null;

  return toInvestment(investment.data, summary.data ?? undefined);
}

export async function getInvestmentEntries(
  investmentId: string,
): Promise<InvestmentEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investment_entries")
    .select("*")
    .eq("investment_id", investmentId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    investmentId: row.investment_id,
    type: row.type,
    amount: row.amount,
    units: row.units,
    price: row.price,
    occurredOn: row.occurred_on,
    note: row.note,
    scheduled: row.scheduled,
  }));
}

export const getInvestmentGoals = cache(
  async (): Promise<InvestmentGoal[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("investment_goals")
      .select("id, name, tint, target_amount")
      .order("sort_order")
      .order("created_at");

    if (error) throw new Error(error.message);

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      tint: isTint(row.tint) ? row.tint : "neutral",
      targetAmount: row.target_amount,
    }));
  },
);

/**
 * What went into open investments this calendar month, `from` being the
 * first of it. Instalments posted by a schedule count: they are money in.
 */
export async function getInvestedSince(from: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investment_entries")
    .select("amount, investment:investments!inner(status)")
    .eq("type", "invest")
    .gte("occurred_on", from)
    .eq("investment.status", "open");

  if (error) throw new Error(error.message);

  return data.reduce((sum, row) => sum + row.amount, 0);
}
