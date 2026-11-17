import { z } from "zod";

import { CADENCES, INVESTMENT_KINDS, KIND_META } from "@/lib/investments";
import { TINT_KEYS } from "@/lib/tokens";

/**
 * What the investment screens may send.
 *
 * Amounts arrive as the keypad's text and are parsed on the server with the
 * user's decimal places, like every other amount in Paisa. The rules per
 * kind mirror the table's CHECKs, so the user hears "an RD needs a maturity
 * date" rather than a refused insert.
 */

const uuid = z.string().uuid();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31");
const amountText = z.string().trim().min(1, "Enter an amount.");
const optionalAmountText = z.string().trim().nullable().optional();
const shortText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const scheduleInputSchema = z
  .object({
    amount: amountText,
    cadence: z.enum(CADENCES),
    /** The first instalment, or on an edit the next one. Anchors the day. */
    firstDate: day,
    ends: z.enum(["never", "count", "date"]),
    count: z.coerce.number().int().min(1).max(600).nullable().optional(),
    endDate: day.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ends === "count" && !value.count) {
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "How many instalments?",
      });
    }
    if (value.ends === "date") {
      if (!value.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "Pick the last date.",
        });
      } else if (value.endDate < value.firstDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "The end is before the first instalment.",
        });
      }
    }
  });

export const maturityInputSchema = z.object({
  rate: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (value) =>
        !value || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100),
      "Use a rate like 7.1",
    ),
  tenureMonths: z.coerce.number().int().min(1).max(600).nullable().optional(),
  maturityDate: day,
  maturityAmount: optionalAmountText,
});

export const firstEntryInputSchema = z.object({
  amount: amountText,
  date: day,
});

const investmentFields = {
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(80, "That name is a bit long."),
  goalId: uuid.nullable().optional(),
  platform: shortText(60, "Keep the platform under 60 characters."),
  folio: shortText(60, "Keep the folio under 60 characters."),
  note: shortText(500, "That note is a bit long."),
  schedule: scheduleInputSchema.nullable().optional(),
  maturity: maturityInputSchema.nullable().optional(),
};

function checkKind(
  value: {
    kind: (typeof INVESTMENT_KINDS)[number];
    schedule?: unknown;
    maturity?: unknown;
  },
  ctx: z.RefinementCtx,
) {
  const meta = KIND_META[value.kind];

  if (meta.schedule === "required" && !value.schedule) {
    ctx.addIssue({
      code: "custom",
      path: ["schedule"],
      message: `${meta.label === "RD" ? "An RD" : "A SIP"} needs an instalment amount and date.`,
    });
  }
  if (meta.schedule === "none" && value.schedule) {
    ctx.addIssue({
      code: "custom",
      path: ["schedule"],
      message: `${meta.label} does not repeat.`,
    });
  }
  if (meta.maturity && !value.maturity) {
    ctx.addIssue({
      code: "custom",
      path: ["maturity"],
      message: "Add the maturity date.",
    });
  }
  if (!meta.maturity && value.maturity) {
    ctx.addIssue({
      code: "custom",
      path: ["maturity"],
      message: "Only an FD or RD has a maturity.",
    });
  }
}

export const createInvestmentSchema = z
  .object({
    kind: z.enum(INVESTMENT_KINDS),
    ...investmentFields,
    /** A deposit, a lump sum, or what was already held before Paisa. */
    firstEntry: firstEntryInputSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    checkKind(value, ctx);

    if (value.kind === "fd" && !value.firstEntry) {
      ctx.addIssue({
        code: "custom",
        path: ["firstEntry"],
        message: "Enter the deposit amount.",
      });
    }

    const start = value.firstEntry?.date ?? value.schedule?.firstDate;
    if (value.maturity && start && value.maturity.maturityDate <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["maturityDate"],
        message: "The maturity date has to be after the first deposit.",
      });
    }
  });

/** The kind is fixed once made: an FD does not become a SIP. */
export const updateInvestmentSchema = z
  .object({
    id: uuid,
    kind: z.enum(INVESTMENT_KINDS),
    ...investmentFields,
  })
  .superRefine(checkKind);

export const investmentIdSchema = z.object({ id: uuid });

export const pauseInvestmentSchema = z.object({
  id: uuid,
  paused: z.boolean(),
});

export const closeInvestmentSchema = z.object({ id: uuid, on: day });

export const payoutSchema = z.object({
  id: uuid,
  amount: amountText,
  on: day,
  close: z.boolean().default(true),
});

const entryFields = {
  type: z.enum(["invest", "redeem"]),
  amount: amountText,
  date: day,
  units: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (value) => !value || /^\d{1,14}(\.\d{1,6})?$/.test(value),
      "Use units like 12.345",
    ),
  price: optionalAmountText,
  note: shortText(500, "That note is a bit long."),
};

export const createEntrySchema = z.object({
  investmentId: uuid,
  ...entryFields,
});

export const updateEntrySchema = z.object({ id: uuid, ...entryFields });

export const entryIdSchema = z.object({ id: uuid });

const goalFields = {
  name: z
    .string()
    .trim()
    .min(1, "Give the goal a name.")
    .max(60, "That name is a bit long."),
  tint: z.enum(TINT_KEYS),
  target: optionalAmountText,
};

export const createGoalSchema = z.object(goalFields);
export const updateGoalSchema = z.object({ id: uuid, ...goalFields });
export const goalIdSchema = z.object({ id: uuid });

export type CreateInvestmentInput = z.input<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.input<typeof updateInvestmentSchema>;
export type ScheduleInput = z.input<typeof scheduleInputSchema>;
export type MaturityInput = z.input<typeof maturityInputSchema>;
export type CreateEntryInput = z.input<typeof createEntrySchema>;
export type UpdateEntryInput = z.input<typeof updateEntrySchema>;
export type PayoutInput = z.input<typeof payoutSchema>;
export type CreateGoalInput = z.input<typeof createGoalSchema>;
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;
