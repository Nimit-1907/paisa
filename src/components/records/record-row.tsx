"use client";

import {
  ArrowRight,
  CopyPlus,
  Pencil,
  Repeat,
  ThumbsDown,
  Trash2,
} from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { Tile } from "@/components/shared/tile";
import { ListRow } from "@/components/shared/list-row";
import type { TransactionRow } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";

/**
 * What colour a record's amount carries.
 *
 * All three kinds are coloured, including expense. Phase 12 had argued the
 * other way, that in a mostly-expense list the expense colour carries no
 * information, and Phase 14's reference reverses it. On these surfaces the
 * reversal holds up: the money colours are deep and the tints are pale, so
 * three coloured amounts down a column read as a key rather than as three
 * warnings. Measured at 6.5:1 or better on every surface in both themes.
 */
const TONE_CLASS = {
  income: "text-income",
  transfer: "text-transfer",
  expense: "text-expense",
} as const;

/**
 * One record.
 *
 * The anatomy is `ListRow`, shared with accounts, categories and rules, so
 * the eye only has to learn it on the first screen. What is specific to a
 * record is here: which colour the amount takes, what a transfer's second
 * line says, and what the menu offers.
 *
 * Every action is reachable three ways, swipe, long-press or right-click
 * menu, and the edit sheet the row opens, so none of them depends on
 * knowing a gesture.
 */
export function RecordRow({
  record,
  pending = false,
  highlight = false,
  selected = false,
  dense = false,
  onOpen,
  onEdit,
  onLogAgain,
  onDelete,
}: {
  record: TransactionRow;
  /** True while the row is still being saved. */
  pending?: boolean;
  /** Briefly tinted: this is the row that was just saved. */
  highlight?: boolean;
  /** Shown in the detail pane beside the list, on a wide screen. */
  selected?: boolean;
  /** The ledger's tighter row. */
  dense?: boolean;
  /** Tapping the row. Opens the detail. */
  onOpen: () => void;
  /** The menu's Edit, which skips the detail. */
  onEdit: () => void;
  /** A new record from this one, dated now. */
  onLogAgain: () => void;
  onDelete: () => void;
}) {
  const amount = BigInt(record.amount);
  const transfer = record.type === "transfer";

  // On the ledger, a spend or income with a note moves its account under
  // the amount; everywhere else it follows the note on the second line.
  const accountUnderAmount = dense && !transfer && Boolean(record.note);
  // A ledger transfer splits its two accounts the same way: From on the
  // second line, To under the amount, so neither is cut to "HDFC S…".
  const splitTransfer = dense && transfer;

  const tone: keyof typeof TONE_CLASS =
    record.type === "income" ? "income" : transfer ? "transfer" : "expense";

  return (
    <ListRow
      dense={dense}
      pending={pending}
      highlight={highlight}
      selected={selected}
      onClick={onOpen}
      leading={
        <Tile
          size="md"
          tint={transfer ? "sky" : record.categoryTint}
          icon={transfer ? "ArrowLeftRight" : record.categoryIcon}
        />
      }
      /*
       * A transfer has no category, so its title slot used to hold the
       * constant word "Transfer" while the note and both account names
       * fought over the second line, and at 360px all three lost, leaving
       * "Paytm to… · HDFC Sa… → Paytm …", which answers nothing. The icon
       * and the figure's colour already say "transfer"; the note goes in
       * the free slot, and the accounts get the whole line to themselves.
       * The word stays for a screen reader, which has no icon to read.
       */
      title={
        transfer ? (
          record.note ? (
            <>
              {record.note}
              <span className="sr-only"> · Transfer</span>
            </>
          ) : (
            "Transfer"
          )
        ) : (
          (record.categoryName ?? "Uncategorised")
        )
      }
      titleBadge={
        record.recurringRuleId || record.worthIt === false ? (
          <>
            {record.recurringRuleId ? (
              <Repeat
                className="text-text-secondary size-3 shrink-0"
                role="img"
                aria-label="Repeats"
              />
            ) : null}
            {record.worthIt === false ? (
              <ThumbsDown
                className="text-expense size-3 shrink-0"
                role="img"
                aria-label="Regretted"
              />
            ) : null}
          </>
        ) : null
      }
      subtitle={
        accountUnderAmount ? (
          // The ledger's row is narrower: the note has the line to itself
          // and the account sits under the amount.
          <span className="min-w-0 truncate">{record.note}</span>
        ) : splitTransfer ? (
          <span className="min-w-0 truncate">
            <span className="sr-only">From </span>
            {record.accountName}
          </span>
        ) : (
          <>
            {record.note && !transfer ? (
              <>
                {/*
                The note shrinks last. Two truncating siblings share a
                shortfall in proportion to their width, so at 360px both got
                cut and "Zomato, team lunch · ICICI Credit Card" came out as
                "Zomato, tea… · ICICI Credi…", two half-words where one
                whole one would do. The note is what identifies the record;
                the account is context. So the account gives up the room,
                down to a floor that still reads as a name, and only then
                does the note shrink. (A 70% cap on the note did the
                opposite at 360px: both were cut.)
              */}
                <span className="min-w-0 truncate">{record.note}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {transfer ? (
              <span className="flex min-w-0 items-center gap-0.5">
                <span className="truncate">{record.accountName}</span>
                <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{record.toAccountName}</span>
              </span>
            ) : (
              <span
                className={cn(
                  "truncate",
                  record.note && "min-w-[6ch] shrink-[100]",
                )}
              >
                {record.accountName}
              </span>
            )}
          </>
        )
      }
      trailingMeta={
        accountUnderAmount ? (
          // The account's whole name: the note is what gives way. Capped
          // only so an unusually long name cannot take the whole row.
          <span className="block max-w-36 truncate lg:max-w-48">
            {record.accountName}
          </span>
        ) : splitTransfer ? (
          <span className="flex max-w-36 items-center justify-end gap-0.5 lg:max-w-48">
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">to </span>
            <span className="truncate">{record.toAccountName}</span>
          </span>
        ) : undefined
      }
      trailing={
        // The sign and the figure share one coloured wrapper. Colouring only
        // the figure would leave a green amount behind an ink-coloured plus.
        <span className={TONE_CLASS[tone]}>
          {record.type === "income"
            ? "+"
            : record.type === "expense"
              ? "−"
              : ""}
          <Amount value={amount} signDisplay="never" />
        </span>
      }
      swipeLeft={{
        label: "Delete",
        icon: Trash2,
        tone: "destructive",
        onAction: onDelete,
      }}
      // Three actions, each reachable three ways: swipe, the long-press
      // menu, and the buttons on the record's own sheet. A swipe right
      // uncovers two, Edit and Log again, side by side, so Log again is
      // not left behind a menu alone.
      swipeRight={[
        { label: "Edit", icon: Pencil, onAction: onEdit },
        { label: "Log again", icon: CopyPlus, onAction: onLogAgain },
      ]}
      menu={[
        { label: "Edit", icon: Pencil, onAction: onEdit },
        { label: "Log again", icon: CopyPlus, onAction: onLogAgain },
        {
          label: "Delete",
          icon: Trash2,
          tone: "destructive" as const,
          onAction: onDelete,
        },
      ]}
    />
  );
}
