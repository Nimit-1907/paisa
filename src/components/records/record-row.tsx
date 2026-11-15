"use client";

import { ArrowRight, Copy, Pencil, Repeat, Search, Trash2 } from "lucide-react";

import { Amount } from "@/components/shared/amount";
import { ColorDot } from "@/components/shared/color-dot";
import { ListRow } from "@/components/shared/list-row";
import type { TransactionRow } from "@/lib/queries/transactions";

/**
 * What colour a record's amount carries.
 *
 * Expense stays in plain ink. Phase 12 softened the money palette because
 * three colours down one list read as three warnings, and in a list that is
 * mostly expenses the expense colour carries no information at all — income
 * and transfers are the ones worth marking.
 */
const TONE_CLASS = {
  income: "text-income",
  transfer: "text-transfer",
  ink: "text-ink",
} as const;

/**
 * One record.
 *
 * The anatomy is `ListRow`, shared with accounts, categories and rules, so
 * the eye only has to learn it on the first screen. What is specific to a
 * record is here: which colour the amount takes, what a transfer's second
 * line says, and what the menu offers.
 *
 * Every action is reachable three ways — swipe, long-press or right-click
 * menu, and the edit sheet the row opens — so none of them depends on
 * knowing a gesture.
 */
export function RecordRow({
  record,
  pending = false,
  highlight = false,
  selected = false,
  onOpen,
  onCopy,
  onDelete,
  onShowSimilar,
}: {
  record: TransactionRow;
  /** True while the row is still being saved. */
  pending?: boolean;
  /** Briefly tinted: this is the row that was just saved. */
  highlight?: boolean;
  /** Shown in the detail pane beside the list, on a wide screen. */
  selected?: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  /** Omitted for a transfer, which has no category to be similar to. */
  onShowSimilar?: () => void;
}) {
  const amount = BigInt(record.amount);
  const transfer = record.type === "transfer";

  const tone: keyof typeof TONE_CLASS =
    record.type === "income" ? "income" : transfer ? "transfer" : "ink";

  return (
    <ListRow
      pending={pending}
      highlight={highlight}
      selected={selected}
      onClick={onOpen}
      leading={
        <ColorDot
          size="lg"
          color={transfer ? null : record.categoryColor}
          icon={transfer ? "ArrowLeftRight" : record.categoryIcon}
        />
      }
      title={transfer ? "Transfer" : (record.categoryName ?? "Uncategorised")}
      titleBadge={
        record.recurringRuleId ? (
          <Repeat className="text-ink-3 size-3 shrink-0" aria-label="Repeats" />
        ) : null
      }
      subtitle={
        <>
          {record.note ? (
            <>
              <span className="truncate">{record.note}</span>
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
            <span className="truncate">{record.accountName}</span>
          )}
        </>
      }
      trailing={
        // The sign and the figure share one coloured wrapper. Colouring only
        // the figure would leave a green amount behind an ink-coloured plus.
        <span className={TONE_CLASS[tone]}>
          {record.type === "income" ? "+" : record.type === "expense" ? "−" : ""}
          <Amount value={amount} signDisplay="never" />
        </span>
      }
      swipeLeft={{
        label: "Delete",
        icon: Trash2,
        tone: "destructive",
        onAction: onDelete,
      }}
      swipeRight={{ label: "Copy", icon: Copy, onAction: onCopy }}
      menu={[
        { label: "Edit", icon: Pencil, onAction: onOpen },
        { label: "Duplicate", icon: Copy, onAction: onCopy },
        ...(onShowSimilar
          ? [{ label: "Show similar", icon: Search, onAction: onShowSimilar }]
          : []),
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
