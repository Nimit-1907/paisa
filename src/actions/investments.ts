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
import { parseAmount } from "@/lib/amount";
import { cadenceToSchedule, endAfterInstallments } from "@/lib/investments";
import { toDb } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { currencyOf, getProfile } from "@/lib/profile";
import { localToday } from "@/lib/recurring-check";
import {
  type CreateEntryInput,
  type CreateGoalInput,
  type CreateInvestmentInput,
  type PayoutInput,
  type UpdateEntryInput,
  type UpdateGoalInput,
  type UpdateInvestmentInput,
  closeInvestmentSchema,
  createEntrySchema,
  createGoalSchema,
  createInvestmentSchema,
  entryIdSchema,
  goalIdSchema,
  investmentIdSchema,
  pauseInvestmentSchema,
  payoutSchema,
  updateEntrySchema,
  updateGoalSchema,
  updateInvestmentSchema,
} from "@/lib/schemas/investments";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InvestmentUpdate = Database["public"]["Tables"]["investments"]["Update"];

/**
 * The investments ledger's actions. None of them touch accounts, records or
 * budgets: the module was asked to stay separate, so a revalidation here
 * only ever reaches the investments screens.
 */
function revalidateInvestments(id?: string) {
  revalidatePath("/investments");
  if (id) revalidatePath(`/investments/${id}`);
}

async function context() {
  const profile = await getProfile();
  return {
    decimals: currencyOf(profile).decimals,
    today: localToday(profile?.timezone ?? DEFAULT_TIME_ZONE),
  };
}

/** A positive amount in minor units, or the message to show. */
function money(
  text: string,
  decimals: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = parseAmount(text, decimals);
  if (!parsed.ok) return parsed;
  if (parsed.minor <= 0n) {
    return { ok: false, error: "An amount has to be more than zero." };
  }
  return { ok: true, value: toDb(parsed.minor) };
}

function optionalMoney(
  text: string | null | undefined,
  decimals: number,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (!text || !text.trim()) return { ok: true, value: null };
  return money(text, decimals);
}

/** The table's CHECKs and the ownership triggers, in words. */
function failFromInvestmentDb(
  error: { code?: string; message: string },
  fallback: string,
): ActionResult<never> {
  if (error.code === "42501") {
    return fail("That goal or investment is not available any more.");
  }
  if (error.code === "23514") {
    return failFromDb(error, "Those details do not fit this kind of investment.");
  }
  return failFromDb(error, fallback);
}

// --------------------------------------------------------- schedule, maturity

type ScheduleColumns = Pick<
  InvestmentUpdate,
  | "sched_amount"
  | "frequency"
  | "interval_count"
  | "start_date"
  | "next_run_on"
  | "anchor_day"
  | "end_date"
  | "installments_total"
>;

const NO_SCHEDULE: ScheduleColumns = {
  sched_amount: null,
  frequency: null,
  interval_count: null,
  start_date: null,
  next_run_on: null,
  anchor_day: null,
  end_date: null,
  installments_total: null,
};

function scheduleColumns(
  input: NonNullable<CreateInvestmentInput["schedule"]>,
  decimals: number,
): { ok: true; columns: ScheduleColumns } | { ok: false; error: string; field: string } {
  const amount = money(input.amount, decimals);
  if (!amount.ok) return { ...amount, field: "scheduleAmount" };

  const { frequency, interval } = cadenceToSchedule(input.cadence);
  const anchorDay = Number(input.firstDate.slice(8, 10));

  let endDate: string | null = null;
  let installmentsTotal: number | null = null;

  if (input.ends === "count" && input.count) {
    installmentsTotal = Number(input.count);
    endDate = endAfterInstallments(
      { frequency, interval, startDate: input.firstDate, anchorDay },
      installmentsTotal,
    );
  } else if (input.ends === "date" && input.endDate) {
    endDate = input.endDate;
  }

  return {
    ok: true,
    columns: {
      sched_amount: amount.value,
      frequency,
      interval_count: interval,
      start_date: input.firstDate,
      next_run_on: input.firstDate,
      anchor_day: anchorDay,
      end_date: endDate,
      installments_total: installmentsTotal,
    },
  };
}

type MaturityColumns = Pick<
  InvestmentUpdate,
  "interest_rate" | "tenure_months" | "maturity_date" | "maturity_amount"
>;

const NO_MATURITY: MaturityColumns = {
  interest_rate: null,
  tenure_months: null,
  maturity_date: null,
  maturity_amount: null,
};

function maturityColumns(
  input: NonNullable<CreateInvestmentInput["maturity"]>,
  decimals: number,
): { ok: true; columns: MaturityColumns } | { ok: false; error: string; field: string } {
  const amount = optionalMoney(input.maturityAmount, decimals);
  if (!amount.ok) return { ...amount, field: "maturityAmount" };

  return {
    ok: true,
    columns: {
      interest_rate: input.rate ? Number(input.rate) : null,
      tenure_months: input.tenureMonths ? Number(input.tenureMonths) : null,
      maturity_date: input.maturityDate,
      maturity_amount: amount.value,
    },
  };
}

async function postDue(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const { data, error } = await supabase.rpc("process_due_investments");
  // Not a failure of the save: tomorrow's catch-up posts what this did not.
  if (error) {
    console.error("[investments]", error.message);
    return 0;
  }
  return Number(data ?? 0);
}

// ------------------------------------------------------------- investments --

/**
 * Makes an investment, with its first entry when there is one (an FD's
 * deposit, a lump sum, or what was held before Paisa). A schedule whose
 * first date has arrived posts what it owes straight away.
 */
export async function createInvestment(
  input: CreateInvestmentInput,
): Promise<ActionResult<{ id: string; posted: number }>> {
  const parsed = parseInput(createInvestmentSchema, input);
  if (!parsed.ok) return parsed;
  const value = parsed.data;

  const { decimals, today } = await context();

  let schedule = NO_SCHEDULE;
  if (value.schedule) {
    const built = scheduleColumns(value.schedule, decimals);
    if (!built.ok) return fail(built.error, built.field);
    schedule = built.columns;
  }

  let maturity = NO_MATURITY;
  if (value.maturity) {
    const built = maturityColumns(value.maturity, decimals);
    if (!built.ok) return fail(built.error, built.field);
    maturity = built.columns;
  }

  let firstAmount: number | null = null;
  if (value.firstEntry) {
    const amount = money(value.firstEntry.amount, decimals);
    if (!amount.ok) return fail(amount.error, "firstAmount");
    firstAmount = amount.value;
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("investments")
    .insert({
      user_id: user.id,
      kind: value.kind,
      name: value.name,
      goal_id: value.goalId ?? null,
      platform: value.platform,
      folio: value.folio,
      note: value.note,
      ...schedule,
      ...maturity,
    })
    .select("id")
    .single();

  if (error) return failFromInvestmentDb(error, "Could not save the investment.");

  if (value.firstEntry && firstAmount !== null) {
    const entry = await supabase.from("investment_entries").insert({
      user_id: user.id,
      investment_id: data.id,
      type: "invest",
      amount: firstAmount,
      occurred_on: value.firstEntry.date,
    });

    if (entry.error) {
      // Half an investment is worse than none: take it back out.
      await supabase.from("investments").delete().eq("id", data.id);
      return failFromInvestmentDb(entry.error, "Could not save the investment.");
    }
  }

  const posted =
    value.schedule && value.schedule.firstDate <= today
      ? await postDue(supabase)
      : 0;

  revalidateInvestments(data.id);
  return ok({ id: data.id, posted });
}

/**
 * Saves an investment's details, schedule and maturity. Past entries are
 * never touched: a new SIP amount is a statement about the next instalment,
 * not a correction of the last twelve.
 */
export async function updateInvestment(
  input: UpdateInvestmentInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(updateInvestmentSchema, input);
  if (!parsed.ok) return parsed;
  const value = parsed.data;

  const { decimals, today } = await context();

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data: current, error: readError } = await supabase
    .from("investments")
    .select("kind, start_date, next_run_on, end_date, installments_total, sched_amount")
    .eq("id", value.id)
    .maybeSingle();

  if (readError) return failFromDb(readError, "Could not save the investment.");
  if (!current) return fail("That investment is not available any more.");
  if (current.kind !== value.kind) {
    return fail("An investment's kind cannot change. Make a new one instead.");
  }

  let schedule = NO_SCHEDULE;
  if (value.schedule) {
    // Editing re-anchors the schedule from its next instalment. A date in
    // the past would post a backlog nobody asked for.
    if (value.schedule.firstDate < today) {
      return fail("The next instalment cannot be in the past.", "firstDate");
    }

    const built = scheduleColumns(value.schedule, decimals);
    if (!built.ok) return fail(built.error, built.field);
    schedule = built.columns;

    // An unchanged end keeps saying "60 instalments".
    if (
      value.schedule.ends === "date" &&
      value.schedule.endDate === current.end_date
    ) {
      schedule = { ...schedule, installments_total: current.installments_total };
    }
  }

  let maturity = NO_MATURITY;
  if (value.maturity) {
    const built = maturityColumns(value.maturity, decimals);
    if (!built.ok) return fail(built.error, built.field);
    maturity = built.columns;
  }

  const { error } = await supabase
    .from("investments")
    .update({
      name: value.name,
      goal_id: value.goalId ?? null,
      platform: value.platform,
      folio: value.folio,
      note: value.note,
      ...schedule,
      ...maturity,
    })
    .eq("id", value.id);

  if (error) return failFromInvestmentDb(error, "Could not save the investment.");

  revalidateInvestments(value.id);
  return ok({ id: value.id });
}

/**
 * Pause stops instalments posting. Resume picks up from today: the months
 * it was paused are not posted after the fact, which is what pausing meant.
 */
export async function setInvestmentPaused(input: {
  id: string;
  paused: boolean;
}): Promise<ActionResult> {
  const parsed = parseInput(pauseInvestmentSchema, input);
  if (!parsed.ok) return parsed;

  const { today } = await context();
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("investments")
    .select("next_run_on, sched_amount")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (readError) return failFromDb(readError, "Could not update the schedule.");
  if (!current?.sched_amount) return fail("That investment has no schedule.");

  const patch: InvestmentUpdate = { paused: parsed.data.paused };
  if (!parsed.data.paused && current.next_run_on && current.next_run_on < today) {
    patch.next_run_on = today;
  }

  const { error } = await supabase
    .from("investments")
    .update(patch)
    .eq("id", parsed.data.id);

  if (error) return failFromDb(error, "Could not update the schedule.");

  if (!parsed.data.paused) await postDue(supabase);

  revalidateInvestments(parsed.data.id);
  return ok();
}

export async function skipNextInstallment(input: {
  id: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = parseInput(investmentIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("skip_investment_installment", {
    p_investment_id: parsed.data.id,
  });

  if (error) {
    if (error.code === "P0002") return fail("That investment is not available any more.");
    return failFromDb(error, "Could not skip the instalment.");
  }

  revalidateInvestments(parsed.data.id);
  return ok({ next: data });
}

/** Closing ends any schedule: a closed investment takes nothing more in. */
export async function closeInvestment(input: {
  id: string;
  on: string;
}): Promise<ActionResult> {
  const parsed = parseInput(closeInvestmentSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .update({ status: "closed", closed_on: parsed.data.on })
    .eq("id", parsed.data.id);

  if (error) return failFromDb(error, "Could not close the investment.");

  revalidateInvestments(parsed.data.id);
  return ok();
}

/** Reopening never posts the instalments missed while it was closed. */
export async function reopenInvestment(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = parseInput(investmentIdSchema, input);
  if (!parsed.ok) return parsed;

  const { today } = await context();
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("investments")
    .select("next_run_on")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (readError) return failFromDb(readError, "Could not reopen the investment.");
  if (!current) return fail("That investment is not available any more.");

  const patch: InvestmentUpdate = { status: "open", closed_on: null };
  if (current.next_run_on && current.next_run_on < today) {
    patch.next_run_on = today;
  }

  const { error } = await supabase
    .from("investments")
    .update(patch)
    .eq("id", parsed.data.id);

  if (error) return failFromDb(error, "Could not reopen the investment.");

  await postDue(supabase);
  revalidateInvestments(parsed.data.id);
  return ok();
}

export async function deleteInvestment(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = parseInput(investmentIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return failFromDb(error, "Could not delete the investment.");

  revalidateInvestments();
  return ok();
}

/** A deposit's payout: the redemption and, usually, the close, at once. */
export async function recordPayout(
  input: PayoutInput,
): Promise<ActionResult<{ closed: boolean }>> {
  const parsed = parseInput(payoutSchema, input);
  if (!parsed.ok) return parsed;

  const { decimals } = await context();
  const amount = money(parsed.data.amount, decimals);
  if (!amount.ok) return fail(amount.error, "amount");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_investment_payout", {
    p_investment_id: parsed.data.id,
    p_amount: amount.value,
    p_on: parsed.data.on,
    p_close: parsed.data.close,
  });

  if (error) {
    if (error.code === "P0002") return fail("That investment is not available any more.");
    return failFromDb(error, "Could not record the payout.");
  }

  revalidateInvestments(parsed.data.id);
  return ok({ closed: parsed.data.close });
}

// ------------------------------------------------------------------ entries --

function entryColumns(
  value: {
    type: "invest" | "redeem";
    amount: string;
    date: string;
    units?: string | null;
    price?: string | null;
    note: string | null;
  },
  decimals: number,
):
  | {
      ok: true;
      columns: {
        type: "invest" | "redeem";
        amount: number;
        occurred_on: string;
        units: number | null;
        price: number | null;
        note: string | null;
      };
    }
  | { ok: false; error: string; field: string } {
  const amount = money(value.amount, decimals);
  if (!amount.ok) return { ...amount, field: "amount" };

  const price = optionalMoney(value.price, decimals);
  if (!price.ok) return { ...price, field: "price" };

  return {
    ok: true,
    columns: {
      type: value.type,
      amount: amount.value,
      occurred_on: value.date,
      units: value.units ? Number(value.units) : null,
      price: price.value,
      note: value.note,
    },
  };
}

export async function createEntry(
  input: CreateEntryInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(createEntrySchema, input);
  if (!parsed.ok) return parsed;

  const { decimals } = await context();
  const built = entryColumns(parsed.data, decimals);
  if (!built.ok) return fail(built.error, built.field);

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("investment_entries")
    .insert({
      user_id: user.id,
      investment_id: parsed.data.investmentId,
      ...built.columns,
    })
    .select("id")
    .single();

  if (error) return failFromInvestmentDb(error, "Could not save the entry.");

  revalidateInvestments(parsed.data.investmentId);
  return ok({ id: data.id });
}

export async function updateEntry(
  input: UpdateEntryInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(updateEntrySchema, input);
  if (!parsed.ok) return parsed;

  const { decimals } = await context();
  const built = entryColumns(parsed.data, decimals);
  if (!built.ok) return fail(built.error, built.field);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_entries")
    .update(built.columns)
    .eq("id", parsed.data.id)
    .select("investment_id")
    .maybeSingle();

  if (error) {
    // Two instalments on one day: the schedule's own index.
    if (error.code === "23505") {
      return fail("There is already a scheduled instalment on that date.", "date");
    }
    return failFromInvestmentDb(error, "Could not save the entry.");
  }
  if (!data) return fail("That entry is not available any more.");

  revalidateInvestments(data.investment_id);
  return ok({ id: parsed.data.id });
}

export async function deleteEntry(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = parseInput(entryIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_entries")
    .delete()
    .eq("id", parsed.data.id)
    .select("investment_id")
    .maybeSingle();

  if (error) return failFromDb(error, "Could not delete the entry.");

  revalidateInvestments(data?.investment_id);
  return ok();
}

// -------------------------------------------------------------------- goals --

function goalColumns(
  value: { name: string; tint: string; target?: string | null },
  decimals: number,
):
  | { ok: true; columns: { name: string; tint: string; target_amount: number | null } }
  | { ok: false; error: string; field: string } {
  const target = optionalMoney(value.target, decimals);
  if (!target.ok) return { ...target, field: "target" };

  return {
    ok: true,
    columns: { name: value.name, tint: value.tint, target_amount: target.value },
  };
}

function failFromGoalDb(
  error: { code?: string; message: string },
  name: string,
): ActionResult<never> {
  if (error.code === "23505") {
    return fail(`You already have a goal called ${name}.`, "name");
  }
  return failFromDb(error, "Could not save the goal.");
}

export async function createGoal(
  input: CreateGoalInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(createGoalSchema, input);
  if (!parsed.ok) return parsed;

  const { decimals } = await context();
  const built = goalColumns(parsed.data, decimals);
  if (!built.ok) return fail(built.error, built.field);

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { count } = await supabase
    .from("investment_goals")
    .select("id", { count: "exact", head: true });

  const { data, error } = await supabase
    .from("investment_goals")
    .insert({ user_id: user.id, sort_order: count ?? 0, ...built.columns })
    .select("id")
    .single();

  if (error) return failFromGoalDb(error, parsed.data.name);

  revalidateInvestments();
  return ok({ id: data.id });
}

export async function updateGoal(
  input: UpdateGoalInput,
): Promise<ActionResult> {
  const parsed = parseInput(updateGoalSchema, input);
  if (!parsed.ok) return parsed;

  const { decimals } = await context();
  const built = goalColumns(parsed.data, decimals);
  if (!built.ok) return fail(built.error, built.field);

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_goals")
    .update(built.columns)
    .eq("id", parsed.data.id);

  if (error) return failFromGoalDb(error, parsed.data.name);

  revalidateInvestments();
  return ok();
}

/** Its investments stay, under "No goal". */
export async function deleteGoal(input: { id: string }): Promise<ActionResult> {
  const parsed = parseInput(goalIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_goals")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return failFromDb(error, "Could not delete the goal.");

  revalidateInvestments();
  return ok();
}

