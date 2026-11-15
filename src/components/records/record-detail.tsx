"use client";

import Link from "next/link";

import {
  ArrowRight,
  Copy,
  Pencil,
  Repeat,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { ColorDot } from "@/components/shared/color-dot";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import type { TransactionRow } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";

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
          <SheetBody>
            <div className="text-center">
              <p
                className={cn(
                  "font-display text-[2.5rem] leading-none",
                  record.type === "income"
                    ? "text-income"
                    : transfer
                      ? "text-transfer"
                      : "text-ink",
                )}
              >
                {record.type === "income"
                  ? "+"
                  : record.type === "expense"
                    ? "−"
                    : ""}
                {/* Always exact here. A list can trim ".00"; the screen you
                    opened to check an amount cannot. */}
                <Amount
                  value={BigInt(record.amount)}
                  signDisplay="never"
                  paise="show"
                />
              </p>
            </div>

            <dl className="divide-border bg-card rounded-card divide-y border">
              {transfer ? (
                <Row label="Moved">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{record.accountName}</span>
                    <ArrowRight
                      className="text-ink-3 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{record.toAccountName}</span>
                  </span>
                </Row>
              ) : (
                <>
                  <Row label="Category">
                    <span className="flex min-w-0 items-center gap-2">
                      <ColorDot
                        size="sm"
                        color={record.categoryColor}
                        icon={record.categoryIcon}
                      />
                      <span className="truncate">
                        {record.categoryName ?? "Uncategorised"}
                      </span>
                    </span>
                  </Row>

                  <Row label="Account">
                    <span className="flex min-w-0 items-center gap-2">
                      <Wallet
                        className="text-ink-3 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{record.accountName}</span>
                    </span>
                  </Row>
                </>
              )}

              <Row label="When">{fullWhen(record.occurredAt, timeZone)}</Row>

              {record.note ? (
                <Row label="Note">
                  <span className="break-words">{record.note}</span>
                </Row>
              ) : null}

              {record.recurringRuleId ? (
                <Row label="Repeats">
                  <Link
                    href={`/recurring/${record.recurringRuleId}`}
                    className="text-primary focus-visible:ring-ring inline-flex items-center gap-1.5 rounded font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Repeat className="size-3.5" aria-hidden="true" />
                    See the rule
                  </Link>
                </Row>
              ) : null}
            </dl>

            {/* Duplicate takes the width on its own when there is no
                category to be similar to. A disabled button explaining why
                the other one is missing is noise where a gap would do. */}
            <div
              className={cn(
                "grid gap-2",
                onShowSimilar ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              <Button variant="outline" size="touch" onClick={onCopy}>
                <Copy className="size-4" aria-hidden="true" />
                Duplicate
              </Button>

              {onShowSimilar ? (
                <Button variant="outline" size="touch" onClick={onShowSimilar}>
                  <Search className="size-4" aria-hidden="true" />
                  Show similar
                </Button>
              ) : null}
            </div>

            <Button
              variant="ghost"
              size="touch"
              className="text-destructive hoverable:bg-destructive/10 w-full"
              onClick={onDelete}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete record
            </Button>
          </SheetBody>

          <SheetFooter>
            <Button size="touch" className="flex-1" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit record
            </Button>
          </SheetFooter>
        </>
      ) : null}
    </ResponsiveSheet>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
      <dt className="text-ink-2 shrink-0 text-xs font-semibold">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
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
