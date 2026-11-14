"use client";

import * as React from "react";

import { ArrowRight, Repeat, Trash2 } from "lucide-react";

import { useFormatMoney } from "@/components/profile-provider";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import type { TransactionRow } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";

const REVEAL = 88;

/**
 * One record.
 *
 * Swiping left reveals Delete, which is the gesture people already use for
 * this everywhere else on a phone. It is built on Pointer Events and only
 * takes over once the movement is clearly horizontal, so the list still
 * scrolls normally under a vertical drag. Everything it offers is also on the
 * row's menu-free edit sheet, so nothing depends on knowing the gesture.
 */
export function RecordRow({
  record,
  pending = false,
  onOpen,
  onDelete,
}: {
  record: TransactionRow;
  /** True while the row is still being saved. */
  pending?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const formatMoney = useFormatMoney();

  const [offset, setOffset] = React.useState(0);
  const drag = React.useRef<{
    startX: number;
    startY: number;
    axis: "none" | "x" | "y";
    base: number;
  } | null>(null);

  const amount = BigInt(record.amount);
  const open = offset <= -REVEAL / 2;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (pending || event.pointerType === "mouse") {
      // A mouse has the row's own buttons; the gesture is for thumbs.
      drag.current = null;
      return;
    }

    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      axis: "none",
      base: open ? -REVEAL : 0,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.axis === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Whichever direction won the first few pixels keeps the gesture: this
      // is what stops a swipe from fighting the scroll.
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "y") {
        drag.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const next = Math.min(0, Math.max(-REVEAL - 24, state.base + dx));
    setOffset(next);
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setOffset((current) => (current <= -REVEAL / 2 ? -REVEAL : 0));
  }

  const tone =
    record.type === "income"
      ? "text-income"
      : record.type === "transfer"
        ? "text-transfer"
        : "text-foreground";

  const title =
    record.type === "transfer"
      ? `${record.accountName} → ${record.toAccountName ?? "—"}`
      : (record.categoryName ?? "Uncategorised");

  return (
    <div className="bg-card relative overflow-hidden">
      {/* Sits behind the row and is revealed by the swipe. */}
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={() => {
          setOffset(0);
          onDelete();
        }}
        className="bg-destructive/10 text-destructive absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-0.5 text-xs font-medium"
      >
        <Trash2 className="size-5" aria-hidden="true" />
        Delete
      </button>

      <div
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "bg-card relative transition-transform",
          drag.current && "transition-none",
          pending && "opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOffset(0);
              return;
            }
            onOpen();
          }}
          disabled={pending}
          className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{
              backgroundColor:
                record.type === "transfer"
                  ? "#64748B"
                  : (record.categoryColor ?? "#64748B"),
            }}
          >
            <DynamicIcon
              name={
                record.type === "transfer" ? "ArrowLeftRight" : record.categoryIcon
              }
              className="size-[18px]"
            />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{title}</span>
              {record.recurringRuleId ? (
                <Repeat
                  className="text-muted-foreground size-3 shrink-0"
                  aria-label="Repeats"
                />
              ) : null}
            </span>

            <span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
              {record.note ? (
                <>
                  <span className="truncate">{record.note}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              {record.type === "transfer" ? (
                <span className="flex items-center gap-0.5 truncate">
                  {record.accountName}
                  <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                  {record.toAccountName}
                </span>
              ) : (
                <span className="truncate">{record.accountName}</span>
              )}
            </span>
          </span>

          <span className={cn("amount shrink-0 text-sm font-semibold", tone)}>
            {record.type === "income" ? "+" : record.type === "expense" ? "−" : ""}
            {formatMoney(amount, { signDisplay: "never" })}
          </span>
        </button>
      </div>
    </div>
  );
}
