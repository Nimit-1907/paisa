"use client";

import Link from "next/link";

import {
  ArrowRight,
  CalendarClock,
  Copy,
  Pencil,
  Repeat,
  Search,
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
 * Opening a row used to go straight to the edit sheet, which is the fastest
 * route to fixing a typo and the slowest to everything else — duplicating,
 * finding the rest of this category, or seeing which rule created it were
 * all behind a long-press that announces itself to nobody.
 *
 * This is the trade: one more tap before editing, in exchange for every
 * action on a record being visible in one place. The fast path survives —
 * the row's own menu still has Edit on it — so people who know the gesture
 * keep it.
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
  onCopy,
  onDelete,
  onShowSimilar,
}: {
  /** Null closes the sheet; the row that opened it may have been deleted. */
  record: TransactionRow | null;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onShowSimilar?: () => void;
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
                    value={record.toAccountName ?? "—"}
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

            {/* Duplicate takes the width on its own when there is no
                category to be similar to. A disabled button explaining why
                the other one is missing is noise where a gap would do. */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="touch" onClick={onCopy}>
                <Copy className="size-4" aria-hidden="true" />
                Duplicate
              </Button>

              {onShowSimilar ? (
                <Button
                  variant="secondary"
                  size="touch"
                  onClick={onShowSimilar}
                >
                  <Search className="size-4" aria-hidden="true" />
                  Show similar
                </Button>
              ) : null}

              <Button
                variant="destructive"
                size="touch"
                className={onShowSimilar ? "col-span-2" : undefined}
                onClick={onDelete}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete record
              </Button>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button size="touch" className="flex-1" onClick={onEdit}>
              Edit record
              <Pencil className="size-4" aria-hidden="true" />
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

  return record.note ? `${what} — ${record.note}` : what;
}
