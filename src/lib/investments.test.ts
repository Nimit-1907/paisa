import { describe, expect, it } from "vitest";

import {
  cadenceToSchedule,
  comingUp,
  describeCadence,
  endAfterInstallments,
  goalTotals,
  type Investment,
  type InvestmentSchedule,
  maturedUnpaid,
  nextInstallment,
  openTotals,
  scheduleToCadence,
} from "@/lib/investments";

const TODAY = "2026-11-17";

function schedule(overrides: Partial<InvestmentSchedule> = {}): InvestmentSchedule {
  return {
    amount: 1_000_000,
    cadence: "monthly",
    frequency: "monthly",
    interval: 1,
    startDate: "2025-12-05",
    anchorDay: 5,
    endDate: null,
    installmentsTotal: null,
    nextRunOn: "2026-12-05",
    paused: false,
    skippedDates: [],
    ...overrides,
  };
}

function investment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: "i1",
    kind: "sip",
    name: "Flexi cap",
    goalId: null,
    platform: null,
    folio: null,
    note: null,
    status: "open",
    closedOn: null,
    interestRate: null,
    tenureMonths: null,
    maturityDate: null,
    maturityAmount: null,
    schedule: schedule(),
    invested: 0,
    redeemed: 0,
    net: 0,
    entryCount: 0,
    lastEntryOn: null,
    ...overrides,
  };
}

describe("cadence", () => {
  it("stores quarterly as monthly every 3, and reads it back", () => {
    expect(cadenceToSchedule("quarterly")).toEqual({
      frequency: "monthly",
      interval: 3,
    });
    expect(scheduleToCadence("monthly", 3)).toBe("quarterly");
    expect(scheduleToCadence("monthly", 1)).toBe("monthly");
    expect(scheduleToCadence("yearly", 1)).toBe("yearly");
  });

  it("describes a schedule in plain words", () => {
    expect(describeCadence("monthly", "2025-12-05")).toBe("Monthly on the 5th");
    expect(describeCadence("quarterly", "2026-01-22")).toBe(
      "Quarterly on the 22nd",
    );
    expect(describeCadence("monthly", "2026-01-11")).toBe("Monthly on the 11th");
    expect(describeCadence("yearly", "2025-04-05")).toBe("Yearly on 5 Apr");
  });

  it("turns 'after N instalments' into the last instalment's date", () => {
    const base = {
      frequency: "monthly" as const,
      interval: 1,
      startDate: "2025-06-10",
      anchorDay: 10,
    };
    expect(endAfterInstallments(base, 1)).toBe("2025-06-10");
    expect(endAfterInstallments(base, 60)).toBe("2030-05-10");
    // Clamped through February and back, like the database.
    expect(
      endAfterInstallments({ ...base, startDate: "2026-01-31", anchorDay: 31 }, 2),
    ).toBe("2026-02-28");
  });
});

describe("nextInstallment", () => {
  it("is the cursor when it is in the future", () => {
    expect(nextInstallment(investment(), TODAY)).toBe("2026-12-05");
  });

  it("passes over a skipped date", () => {
    const skipped = investment({
      schedule: schedule({ skippedDates: ["2026-12-05"] }),
    });
    expect(nextInstallment(skipped, TODAY)).toBe("2027-01-05");
  });

  it("is nothing when paused, closed, ended or absent", () => {
    expect(
      nextInstallment(investment({ schedule: schedule({ paused: true }) }), TODAY),
    ).toBeNull();
    expect(nextInstallment(investment({ status: "closed" }), TODAY)).toBeNull();
    expect(
      nextInstallment(
        investment({ schedule: schedule({ endDate: "2026-11-30" }) }),
        TODAY,
      ),
    ).toBeNull();
    expect(nextInstallment(investment({ schedule: null }), TODAY)).toBeNull();
  });
});

describe("comingUp", () => {
  it("lists instalments and maturities within the window, soonest first", () => {
    const sip = investment();
    const fd = investment({
      id: "fd",
      kind: "fd",
      schedule: null,
      maturityDate: "2026-11-28",
      maturityAmount: 21_461_800,
    });
    const farFd = investment({
      id: "far",
      kind: "fd",
      schedule: null,
      maturityDate: "2027-06-01",
    });

    const items = comingUp([sip, fd, farFd], TODAY);
    expect(items.map((item) => [item.investment.id, item.kind, item.inDays])).toEqual([
      ["fd", "maturity", 11],
      ["i1", "installment", 18],
    ]);
  });

  it("keeps a matured deposit until it is paid out", () => {
    const late = investment({
      kind: "fd",
      schedule: null,
      maturityDate: "2026-11-10",
    });
    expect(comingUp([late], TODAY)[0]?.inDays).toBe(-7);
    expect(maturedUnpaid([late], TODAY)).toHaveLength(1);
    expect(maturedUnpaid([{ ...late, status: "closed" }], TODAY)).toHaveLength(0);
  });
});

describe("totals", () => {
  const goals = [
    { id: "ret", name: "Retirement", tint: "peri" as const, targetAmount: null },
    { id: "home", name: "House", tint: "sand" as const, targetAmount: 100_000_000 },
    { id: "car", name: "Car", tint: "sky" as const, targetAmount: null },
  ];

  const rows = [
    investment({ id: "a", goalId: "ret", invested: 3_000_000, redeemed: 0, net: 3_000_000 }),
    investment({ id: "b", goalId: "home", invested: 6_000_000, redeemed: 1_000_000, net: 5_000_000 }),
    investment({ id: "c", goalId: null, invested: 2_000_000, redeemed: 0, net: 2_000_000 }),
    investment({
      id: "d",
      goalId: "ret",
      status: "closed",
      invested: 9_000_000,
      redeemed: 9_500_000,
      net: -500_000,
    }),
  ];

  it("adds the open investments only", () => {
    expect(openTotals(rows)).toEqual({
      invested: 11_000_000,
      redeemed: 1_000_000,
      net: 10_000_000,
      count: 3,
    });
  });

  it("groups by goal, with progress to a target or a share of the whole", () => {
    const totals = goalTotals(goals, rows);

    expect(totals.map((row) => [row.goal?.name ?? "No goal", row.net, row.basis, Math.round(row.percent)])).toEqual([
      ["Retirement", 3_000_000, "share", 30],
      ["House", 5_000_000, "target", 5],
      ["Car", 0, "share", 0],
      ["No goal", 2_000_000, "share", 20],
    ]);
  });
});
