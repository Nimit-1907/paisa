"use client";

import Link from "next/link";

import {
  ArrowRight,
  CalendarClock,
  Pencil,
  Repeat,
  Trash2,
  Wallet,
} from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { FieldCard } from "@/components/shared/field-card";
import { HeroStat } from "@/components/shared/hero-stat";
import { Tile } from "@/components/shared/tile";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { REPEAT_LABELS } from "@/lib/schemas/transactions";
import type { TransactionRow } from "@/lib/queries/transactions";

/**
 * One record, read rather than edited.
 *
 * Two actions, Edit and Delete, in the footer. The facts are above them:
 * the amount as the hero, then the same field cards the add sheet uses.
 *
 * Deliberately not a form. Everything here is a fact about the record and a
 * place to go next; the moment it starts holding a value it has to worry
 * about saving, and there is already a sheet that does that properly.
 *
 * Phase 14 makes the amount the hero — the thing you opened this to check —
 * with the category's tile beside its name, and turns the table of rows into
 * the same field cards the add sheet uses. The facts are the same; they are
 * no longer a spreadsheet.
 */
export function RecordDetail({
  record,
  timeZone,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  /** Null closes the sheet; the row that opened it may have been deleted. */
  record: TransactionRow | null;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const transfer = record?.type === "transfer";

  return (
    <ResponsiveSheet
      open={record !== null}
      onOpenChange={onOpenChange}
      title="Record"
      description={record ? describe(record) : "Record"}
    >
      {record ? (
        <>
          <SheetBody className="space-y-3">
            <HeroStat
              label={
                <span className="flex min-w-0 items-center gap-2">
                  <Tile
                    size="sm"
                    tint={transfer ? "sky" : record.categoryTint}
                    icon={transfer ? "ArrowLeftRight" : record.categoryIcon}
                  />
                  <span className="text-text truncate font-semibold">
                    {transfer
                      ? "Transfer"
                      : (record.categoryName ?? "Uncategorised")}
                  </span>
                </span>
              }
              trend={
                record.recurringRuleId ? (
                  // A pill that goes somewhere. The rule is the thing that
                  // will make this record happen again, and "see the rule"
                  // buried in a table row was never found.
                  <Link
                    href={`/recurring/${record.recurringRuleId}`}
                    className="bg-tint-peri text-text rounded-full px-2 py-[3px] text-[11px] font-semibold"
                  >
                    <Repeat
                      className="mr-1 inline size-3 align-[-1px]"
                      aria-hidden="true"
                    />
                    Repeats {repeatWord(record.recurringFrequency)}
                  </Link>
                ) : null
              }
              value={
                <span
                  className={
                    record.type === "income"
                      ? "text-income"
                      : transfer
                        ? "text-transfer"
                        : "text-text"
                  }
                >
                  {record.type === "income"
                    ? "+"
                    : record.type === "expense"
                      ? "−"
                      : ""}
                  {/* Always exact here. A list can trim ".00"; the screen
                      you opened to check an amount cannot. */}
                  <Amount
                    value={BigInt(record.amount)}
                    signDisplay="never"
                    paise="show"
                  />
                </span>
              }
            />

            <div className="grid grid-cols-2 gap-2">
              {transfer ? (
                <>
                  <FieldCard
                    label="From"
                    icon={
                      <Wallet
                        className="text-text-secondary size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    }
                    value={record.accountName}
                  />
                  <FieldCard
                    label="To"
                    icon={
                      <ArrowRight
                        className="text-text-secondary size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    }
                    value={record.toAccountName ?? "None"}
                  />
                </>
              ) : (
                <FieldCard
                  label="Account"
                  icon={
                    <Wallet
                      className="text-text-secondary size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  value={record.accountName}
                />
              )}

              <FieldCard
                label="When"
                className={transfer ? "col-span-2" : undefined}
                icon={
                  <CalendarClock
                    className="text-text-secondary size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                }
                value={fullWhen(record.occurredAt, timeZone)}
              />

              {record.note ? (
                <FieldCard
                  label="Note"
                  className="col-span-2"
                  value={
                    // The one field that is allowed to wrap: a note is a
                    // sentence somebody wrote, and truncating it to one
                    // line is how the detail screen fails at its only job.
                    <span className="block break-words whitespace-normal">
                      {record.note}
                    </span>
                  }
                />
              ) : null}
            </div>

          </SheetBody>

          {/* Edit and Delete, and nothing else: the record's two actions,
              side by side and the same size, so neither is hiding. */}
          <SheetFooter className="flex-row gap-2">
            <Button
              variant="destructive"
              size="touch"
              className="flex-1"
              onClick={onDelete}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
            <Button size="touch" className="flex-1" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          </SheetFooter>
        </>
      ) : null}
    </ResponsiveSheet>
  );
}

/** "monthly", "weekly" — the pill reads "Repeats monthly". */
function repeatWord(frequency: TransactionRow["recurringFrequency"]): string {
  return frequency ? REPEAT_LABELS[frequency].toLowerCase() : "on a schedule";
}

/** "Mon, 9 Nov 2026 at 4:30 pm", where the user is. */
function fullWhen(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

/** The one-line version, for the dialog's accessible description. */
function describe(record: TransactionRow): string {
  const what =
    record.type === "transfer"
      ? `Transfer from ${record.accountName} to ${record.toAccountName}`
      : (record.categoryName ?? "Uncategorised");

  return record.note ? `${what}: ${record.note}` : what;
}
