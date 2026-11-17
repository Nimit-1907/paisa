/**
 * The investments ledger, shared by the server and the client.
 *
 * Money in (invest) and money out (redeem), per investment and per goal.
 * It is deliberately separate from accounts and records, and it never
 * values anything: no prices, no interest maths. The only figures are the
 * ones the user typed, and their sums.
 *
 * Amounts here are minor units as plain numbers, the way they cross from
 * the server to the client; `<Amount>` takes `BigInt(value)` at display.
 */

import type { IconName } from "@/lib/icons";
import {
  addDays,
  dayDifference,
  nextOccurrence,
  occurrenceOn,
  type RecurrenceSchedule,
} from "@/lib/recurrence";
import type { TintKey } from "@/lib/tokens";
import type { Database } from "@/types/database";

export type InvestmentKind = Database["public"]["Enums"]["investment_kind"];
export type InvestmentEntryType =
  Database["public"]["Enums"]["investment_entry_type"];

export const INVESTMENT_KINDS = [
  "sip",
  "mutual_fund",
  "rd",
  "fd",
  "stock",
  "ppf",
  "epf",
  "nps",
  "gold",
  "crypto",
  "other",
] as const satisfies readonly InvestmentKind[];

type KindMeta = {
  label: string;
  /** What the list says under the name, when "SIP" would be too terse. */
  long: string;
  icon: IconName;
  tint: TintKey;
  /**
   * Whether it repeats. A SIP and an RD always do, which is what makes them
   * a SIP and an RD; a PPF, EPF or NPS may or may not; nothing else does.
   */
  schedule: "required" | "optional" | "none";
  /** FD and RD: a maturity date and amount, typed from the receipt. */
  maturity: boolean;
  /** Placeholder for the name field. */
  example: string;
};

export const KIND_META: Record<InvestmentKind, KindMeta> = {
  sip: {
    label: "SIP",
    long: "SIP",
    icon: "TrendingUp",
    tint: "peri",
    schedule: "required",
    maturity: false,
    example: "Parag Parikh Flexi Cap",
  },
  mutual_fund: {
    label: "Mutual fund",
    long: "Mutual fund",
    icon: "ChartPie",
    tint: "sky",
    schedule: "none",
    maturity: false,
    example: "Axis Liquid Fund",
  },
  rd: {
    label: "RD",
    long: "Recurring deposit",
    icon: "PiggyBank",
    tint: "teal",
    schedule: "required",
    maturity: true,
    example: "Post Office RD",
  },
  fd: {
    label: "FD",
    long: "Fixed deposit",
    icon: "Landmark",
    tint: "mint",
    schedule: "none",
    maturity: true,
    example: "SBI FD",
  },
  stock: {
    label: "Stocks",
    long: "Stocks / ETF",
    icon: "Briefcase",
    tint: "lilac",
    schedule: "none",
    maturity: false,
    example: "Zerodha portfolio",
  },
  ppf: {
    label: "PPF",
    long: "PPF",
    icon: "Banknote",
    tint: "butter",
    schedule: "optional",
    maturity: false,
    example: "PPF",
  },
  epf: {
    label: "EPF",
    long: "EPF",
    icon: "HandCoins",
    tint: "sand",
    schedule: "optional",
    maturity: false,
    example: "EPF",
  },
  nps: {
    label: "NPS",
    long: "NPS",
    icon: "Umbrella",
    tint: "slate",
    schedule: "optional",
    maturity: false,
    example: "NPS Tier 1",
  },
  gold: {
    label: "Gold",
    long: "Gold",
    icon: "Coins",
    tint: "amber",
    schedule: "none",
    maturity: false,
    example: "Sovereign Gold Bond",
  },
  crypto: {
    label: "Crypto",
    long: "Crypto",
    icon: "CircleDollarSign",
    tint: "rose",
    schedule: "none",
    maturity: false,
    example: "Bitcoin",
  },
  other: {
    label: "Other",
    long: "Other",
    icon: "CircleEllipsis",
    tint: "neutral",
    schedule: "none",
    maturity: false,
    example: "Chit fund",
  },
};

export function isInvestmentKind(value: string): value is InvestmentKind {
  return (INVESTMENT_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------- cadence --

/**
 * How often an instalment comes, in the words people use. Stored as the
 * recurring rules' own frequency and interval, so quarterly is "monthly,
 * every 3", and the database arithmetic is shared.
 */
export const CADENCES = ["monthly", "quarterly", "yearly"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function cadenceToSchedule(cadence: Cadence): {
  frequency: "monthly" | "yearly";
  interval: number;
} {
  switch (cadence) {
    case "monthly":
      return { frequency: "monthly", interval: 1 };
    case "quarterly":
      return { frequency: "monthly", interval: 3 };
    case "yearly":
      return { frequency: "yearly", interval: 1 };
  }
}

export function scheduleToCadence(
  frequency: string,
  interval: number,
): Cadence {
  if (frequency === "yearly") return "yearly";
  return interval === 3 ? "quarterly" : "monthly";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ordinal(n: number): string {
  const teen = n % 100;
  if (teen >= 11 && teen <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Monthly on the 5th", "Quarterly on the 10th", "Yearly on 5 Apr". */
export function describeCadence(
  cadence: Cadence,
  startDate: string,
  anchorDay?: number | null,
): string {
  const day = anchorDay ?? Number(startDate.slice(8, 10));
  if (cadence === "yearly") {
    return `Yearly on ${day} ${MONTHS[Number(startDate.slice(5, 7)) - 1]}`;
  }
  return `${CADENCE_LABELS[cadence]} on the ${ordinal(day)}`;
}

/**
 * The last instalment of a schedule that stops after `count` of them, so
 * "after 60 instalments" can be stored as the end date the engine reads.
 */
export function endAfterInstallments(
  schedule: Pick<RecurrenceSchedule, "frequency" | "interval" | "startDate" | "anchorDay">,
  count: number,
): string {
  return occurrenceOn(
    { ...schedule, endDate: null, skippedDates: [] },
    Math.max(0, count - 1),
  );
}

// ---------------------------------------------------------------- shapes ---

export type InvestmentSchedule = {
  /** Minor units per instalment. */
  amount: number;
  cadence: Cadence;
  frequency: "monthly" | "yearly";
  interval: number;
  startDate: string;
  anchorDay: number | null;
  endDate: string | null;
  installmentsTotal: number | null;
  /** The next instalment the engine has not posted yet. */
  nextRunOn: string;
  paused: boolean;
  skippedDates: string[];
};

export type Investment = {
  id: string;
  kind: InvestmentKind;
  name: string;
  goalId: string | null;
  platform: string | null;
  folio: string | null;
  note: string | null;
  status: "open" | "closed";
  closedOn: string | null;
  interestRate: number | null;
  tenureMonths: number | null;
  maturityDate: string | null;
  maturityAmount: number | null;
  schedule: InvestmentSchedule | null;
  invested: number;
  redeemed: number;
  net: number;
  entryCount: number;
  lastEntryOn: string | null;
};

export type InvestmentGoal = {
  id: string;
  name: string;
  tint: TintKey;
  targetAmount: number | null;
};

export type InvestmentEntry = {
  id: string;
  investmentId: string;
  type: InvestmentEntryType;
  amount: number;
  units: number | null;
  price: number | null;
  occurredOn: string;
  note: string | null;
  scheduled: boolean;
};

function recurrenceOf(schedule: InvestmentSchedule): RecurrenceSchedule {
  return {
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate,
    anchorDay: schedule.anchorDay,
    endDate: schedule.endDate,
    skippedDates: schedule.skippedDates,
  };
}

/**
 * When the next instalment posts, or null when nothing will: no schedule,
 * paused, closed, or past its end.
 */
export function nextInstallment(
  investment: Pick<Investment, "schedule" | "status">,
  today: string,
): string | null {
  const schedule = investment.schedule;
  if (!schedule || schedule.paused || investment.status !== "open") {
    return null;
  }

  const from = schedule.nextRunOn > today ? schedule.nextRunOn : today;
  return nextOccurrence(recurrenceOf(schedule), from);
}

// ------------------------------------------------------------- coming up ---

export type ComingUpItem = {
  investment: Investment;
  date: string;
  kind: "installment" | "maturity";
  /** The instalment, or the maturity amount if one was saved. */
  amount: number | null;
  /** Days from today; negative for a maturity that has passed unpaid. */
  inDays: number;
};

/**
 * What is due or maturing in the next `days` days, soonest first.
 *
 * A deposit that has already matured stays on the list until its payout is
 * recorded or it is closed: "it matured last Tuesday" is the most useful
 * thing this list can say, and it should not vanish because a day passed.
 */
export function comingUp(
  investments: Investment[],
  today: string,
  days = 30,
): ComingUpItem[] {
  const until = addDays(today, days);
  const items: ComingUpItem[] = [];

  for (const investment of investments) {
    if (investment.status !== "open") continue;

    const next = nextInstallment(investment, today);
    if (next && next <= until) {
      items.push({
        investment,
        date: next,
        kind: "installment",
        amount: investment.schedule?.amount ?? null,
        inDays: dayDifference(today, next),
      });
    }

    if (investment.maturityDate && investment.maturityDate <= until) {
      items.push({
        investment,
        date: investment.maturityDate,
        kind: "maturity",
        amount: investment.maturityAmount,
        inDays: dayDifference(today, investment.maturityDate),
      });
    }
  }

  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === b.kind ? 0 : a.kind === "maturity" ? -1 : 1),
  );
}

/** Open deposits whose maturity date has arrived and that are not paid out. */
export function maturedUnpaid(
  investments: Investment[],
  today: string,
): Investment[] {
  return investments.filter(
    (investment) =>
      investment.status === "open" &&
      investment.maturityDate !== null &&
      investment.maturityDate <= today,
  );
}

// ---------------------------------------------------------------- totals ---

export type LedgerTotals = {
  invested: number;
  redeemed: number;
  net: number;
  count: number;
};

/** Invested, redeemed and net across the open investments. */
export function openTotals(investments: Investment[]): LedgerTotals {
  let invested = 0;
  let redeemed = 0;
  let count = 0;

  for (const investment of investments) {
    if (investment.status !== "open") continue;
    invested += investment.invested;
    redeemed += investment.redeemed;
    count += 1;
  }

  return { invested, redeemed, net: invested - redeemed, count };
}

export type GoalTotal = {
  goal: InvestmentGoal | null;
  net: number;
  count: number;
  /**
   * Towards the target when the goal has one, otherwise its share of the
   * whole net. Never negative; may pass 100 when a target is beaten.
   */
  percent: number;
  /** Which of the two `percent` means. */
  basis: "target" | "share";
};

/**
 * Net per goal, over open investments, in the goals' own order, then
 * "No goal" if anything has none. A goal with nothing in it still shows,
 * at zero: it was made on purpose and is waiting for its first investment.
 */
export function goalTotals(
  goals: InvestmentGoal[],
  investments: Investment[],
): GoalTotal[] {
  const open = investments.filter((investment) => investment.status === "open");
  const whole = open.reduce((sum, investment) => sum + investment.net, 0);

  const share = (net: number) =>
    whole > 0 ? Math.max(0, (net / whole) * 100) : 0;

  const rows: GoalTotal[] = goals.map((goal) => {
    const mine = open.filter((investment) => investment.goalId === goal.id);
    const net = mine.reduce((sum, investment) => sum + investment.net, 0);

    if (goal.targetAmount && goal.targetAmount > 0) {
      return {
        goal,
        net,
        count: mine.length,
        percent: Math.max(0, (net / goal.targetAmount) * 100),
        basis: "target",
      };
    }

    return { goal, net, count: mine.length, percent: share(net), basis: "share" };
  });

  const known = new Set(goals.map((goal) => goal.id));
  const loose = open.filter(
    (investment) => !investment.goalId || !known.has(investment.goalId),
  );

  if (loose.length > 0) {
    const net = loose.reduce((sum, investment) => sum + investment.net, 0);
    rows.push({
      goal: null,
      net,
      count: loose.length,
      percent: share(net),
      basis: "share",
    });
  }

  return rows;
}
