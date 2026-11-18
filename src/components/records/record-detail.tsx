"use client";

import Link from "next/link";

import {
  ArrowRight,
  CalendarClock,
  CopyPlus,
  Pencil,
  Repeat,
  MousePointerClick,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldCard } from "@/components/shared/field-card";
import { HeroStat } from "@/components/shared/hero-stat";
import { Tile } from "@/components/shared/tile";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { WorthItToggle } from "@/components/records/worth-it-toggle";
import { Button } from "@/components/ui/button";
import { REPEAT_LABELS } from "@/lib/schemas/transactions";
import type { TransactionRow } from "@/lib/queries/transactions";
import { dateFormat } from "@/lib/date-format";

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
 * Phase 14 makes the amount the hero, the thing you opened this to check,
 * with the category's tile beside its name, and turns the table of rows into
 * the same field cards the add sheet uses. The facts are the same; they are
 * no longer a spreadsheet.
 */
export function RecordDetail({
  record,
  timeZone,
  onOpenChange,
  onEdit,
  onLogAgain,
  onDelete,
}: {
  /** Null closes the sheet; the row that opened it may have been deleted. */
  record: TransactionRow | null;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  /** A new record from this one, dated now. */
  onLogAgain: () => void;
  onDelete: () => void;
}) {
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
            <RecordFacts record={record} timeZone={timeZone} />
          </SheetBody>

          {/* The record's three actions, side by side and the same size, so
              none is hiding: Delete, Log again, Edit. */}
          <SheetFooter className="flex-row gap-2">
            <RecordActions
              onEdit={onEdit}
              onLogAgain={onLogAgain}
              onDelete={onDelete}
            />
          </SheetFooter>
        </>
      ) : null}
    </ResponsiveSheet>
  );
}

/**
 * What a record is: the amount as the hero, then the field cards, then
 * "Worth it?" on a spend. Shared by the sheet and the desktop panel.
 */
function RecordFacts({
  record,
  timeZone,
  flat = false,
}: {
  record: TransactionRow;
  timeZone: string;
  /** No accent: the panel sits beside the month card, which has it. */
  flat?: boolean;
}) {
  const transfer = record.type === "transfer";

  return (
    <>
      <HeroStat
        flat={flat}
        label={
          <span className="flex min-w-0 items-center gap-2">
            <Tile
              size="sm"
              tint={transfer ? "sky" : record.categoryTint}
              icon={transfer ? "ArrowLeftRight" : record.categoryIcon}
            />
            <span className="text-text truncate font-semibold">
              {transfer ? "Transfer" : (record.categoryName ?? "Uncategorised")}
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
              className="bg-tint-peri text-text rounded-full px-2 py-[3px] text-xs font-semibold"
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
          value={
            // Two lines, date then time: on one line at 390px the
            // time was cut off, and the time is half the answer.
            <span className="block whitespace-normal">
              <span className="block">
                {whenDay(record.occurredAt, timeZone)}
              </span>
              <span className="block">
                {whenTime(record.occurredAt, timeZone)}
              </span>
            </span>
          }
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

      {record.type === "expense" ? (
        <WorthItToggle recordId={record.id} value={record.worthIt} />
      ) : null}
    </>
  );
}

/** Delete, Log again and Edit, side by side and the same size. */
function RecordActions({
  onEdit,
  onLogAgain,
  onDelete,
}: {
  onEdit: () => void;
  onLogAgain: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Button
        variant="destructive"
        size="touch"
        className="flex-1"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Delete
      </Button>
      <Button
        variant="outline"
        size="touch"
        className="flex-1"
        onClick={onLogAgain}
      >
        <CopyPlus className="size-4" aria-hidden="true" />
        Log again
      </Button>
      <Button size="touch" className="flex-1" onClick={onEdit}>
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Button>
    </>
  );
}

/**
 * The record beside the list on a wide screen, rather than in a dialog.
 *
 * A dialog on a 1,440px display covers the list it came from, so checking
 * three records meant open, close, open, close. Here the list stays put and
 * the panel shows whichever row was last tapped; that row is marked. With
 * nothing chosen it says how to fill it.
 */
export function RecordDetailPanel({
  record,
  timeZone,
  onClose,
  onEdit,
  onLogAgain,
  onDelete,
}: {
  record: TransactionRow | null;
  timeZone: string;
  onClose: () => void;
  onEdit: () => void;
  onLogAgain: () => void;
  onDelete: () => void;
}) {
  return (
    <aside
      aria-label="Record"
      className="bg-surface rounded-card space-y-3 border p-4"
    >
      {record ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">Record</h2>
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <RecordFacts record={record} timeZone={timeZone} flat />
          <div className="flex gap-2 pt-1">
            <RecordActions
              onEdit={onEdit}
              onLogAgain={onLogAgain}
              onDelete={onDelete}
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={MousePointerClick}
          title="Pick a record"
          description="Its details show here, with Edit, Log again and Delete."
        />
      )}
    </aside>
  );
}

/** "monthly", "weekly", the pill reads "Repeats monthly". */
function repeatWord(frequency: TransactionRow["recurringFrequency"]): string {
  return frequency ? REPEAT_LABELS[frequency].toLowerCase() : "on a schedule";
}

/** "Mon, 9 Nov 2026", where the user is. */
function whenDay(instant: string, timeZone: string): string {
  return dateFormat({
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(instant));
}

/** "4:30 pm", where the user is. */
function whenTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
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
