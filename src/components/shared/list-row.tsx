"use client";

import * as React from "react";

import Link from "next/link";

import type { LucideIcon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

/** One thing a row can do to itself. */
export type RowAction = {
  label: string;
  icon: LucideIcon;
  onAction: () => void;
  tone?: "default" | "destructive";
};

/** How far a row slides to park an action open. */
const REVEAL = 88;
/** Pixels of movement before the gesture decides which axis it is on. */
const AXIS_LOCK = 8;

type ListRowProps = {
  /** The coloured circle, badge or avatar on the left. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** A small icon after the title: "repeats", "paused". */
  titleBadge?: React.ReactNode;
  /** The quieter second line: a note, an account, a frequency. */
  subtitle?: React.ReactNode;
  /** Right-aligned: almost always an amount. */
  trailing?: React.ReactNode;
  /** A smaller line under the trailing figure. */
  trailingMeta?: React.ReactNode;

  href?: string;
  onClick?: () => void;
  /** Highlighted as the row the right-hand pane is showing. */
  selected?: boolean;
  /** Still saving: dimmed and inert. */
  pending?: boolean;
  /** Briefly tinted — the row that just arrived. */
  highlight?: boolean;

  /** Revealed by swiping left (sits against the right edge). */
  swipeLeft?: RowAction;
  /** Revealed by swiping right (sits against the left edge). */
  swipeRight?: RowAction;
  /** Right-click and long-press menu. */
  menu?: RowAction[];
  /** Shown on hover where there is a real pointer. Never the only route. */
  hoverActions?: React.ReactNode;

  className?: string;
};

/**
 * One row, everywhere.
 *
 * Records, accounts, categories, rules and budgets had each grown their own
 * row: different heights, different gaps, three ideas of where the second
 * line goes. This is that anatomy once — circle, title, quiet second line,
 * figure on the right — so the eye only has to learn it on the first screen.
 *
 * Every action on a row is reachable three ways, because each route excludes
 * somebody: a swipe (thumb), a long-press or right-click menu (thumb or
 * mouse, and the only one that announces itself), and — where the screen has
 * the width for it — buttons on hover. Nothing lives *only* behind a gesture,
 * which is the rule that keeps the gesture a shortcut rather than a secret.
 */
export function ListRow({
  leading,
  title,
  titleBadge,
  subtitle,
  trailing,
  trailingMeta,
  href,
  onClick,
  selected = false,
  pending = false,
  highlight = false,
  swipeLeft,
  swipeRight,
  menu,
  hoverActions,
  className,
}: ListRowProps) {
  const [offset, setOffset] = React.useState(0);
  const drag = React.useRef<{
    startX: number;
    startY: number;
    axis: "none" | "x" | "y";
    base: number;
  } | null>(null);

  const parked = offset <= -REVEAL / 2 || offset >= REVEAL / 2;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // A mouse has the hover buttons and the right-click menu; the gesture is
    // for thumbs, and a click-drag with one is almost always a text
    // selection.
    if (pending || event.pointerType === "mouse") {
      drag.current = null;
      return;
    }
    if (!swipeLeft && !swipeRight) return;

    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      axis: "none",
      base: offset <= -REVEAL / 2 ? -REVEAL : offset >= REVEAL / 2 ? REVEAL : 0,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.axis === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      // Whichever direction won the first few pixels keeps the gesture. This
      // is what stops a swipe from fighting the list's scroll.
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "y") {
        drag.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    // A row only travels in a direction that has something to show.
    const min = swipeLeft ? -REVEAL - 24 : 0;
    const max = swipeRight ? REVEAL + 24 : 0;
    setOffset(Math.max(min, Math.min(max, state.base + dx)));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setOffset((current) =>
      current <= -REVEAL / 2 ? -REVEAL : current >= REVEAL / 2 ? REVEAL : 0,
    );
  }

  /**
   * A cancelled pointer is not a decision.
   *
   * The browser cancels when something else takes the gesture over — the
   * back-swipe at the screen edge, a scroll that won after all. Treating that
   * as a release would park a Delete button open because the user tried to go
   * back, so it returns to where the gesture started instead.
   */
  function onPointerCancel() {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    setOffset(state.base);
  }

  function close() {
    setOffset(0);
  }

  const body = (
    <span className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left">
      {leading ? <span className="shrink-0">{leading}</span> : null}

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          {titleBadge}
        </span>
        {subtitle ? (
          <span className="text-text-secondary flex items-center gap-1 truncate text-xs">
            {subtitle}
          </span>
        ) : null}
      </span>

      {trailing || trailingMeta ? (
        <span className="shrink-0 text-right">
          {trailing ? (
            <span className="block text-sm font-semibold">{trailing}</span>
          ) : null}
          {trailingMeta ? (
            <span className="text-text-secondary mt-0.5 block text-xs">
              {trailingMeta}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  const interactiveClass = cn(
    "hoverable:bg-surface-muted  block w-full text-left   ",
    // Colour only, never a transform: a row that shrinks under the thumb
    // drags the whole list with it.
    "duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] transition-colors motion-reduce:transition-none",
    "active:bg-surface-muted",
    selected && "bg-surface-muted hoverable:bg-surface-muted",
    // The accent, washing out over 1.8s: it leads the eye to the new row
    // without asking anything of it, and leaves no colour behind. A
    // keyframe rather than a class that is later removed, because a
    // transition only runs on the *second* render and the row is new.
    highlight && "row-highlight motion-reduce:animate-none",
  );

  const interactive =
    href && !parked ? (
      <Link href={href} className={interactiveClass}>
        {body}
      </Link>
    ) : (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // A parked row has a button showing; the first tap puts it away
          // rather than opening whatever is underneath.
          if (parked) {
            close();
            return;
          }
          onClick?.();
        }}
        className={interactiveClass}
      >
        {body}
      </button>
    );

  const row = (
    <div className={cn("bg-surface group relative overflow-hidden", className)}>
      {/*
        No swipe layers behind a row that is still being saved.

        A pending row is dimmed to 60%, and dimming an opaque row shows
        whatever is painted under it — which here is Copy on one side and
        Delete on the other, both printed through the row for as long as
        the save takes. The row cannot be swiped while pending anyway.
      */}
      {swipeRight && !pending ? (
        <SwipeAction
          action={swipeRight}
          side="left"
          open={offset >= REVEAL / 2}
          onDone={close}
        />
      ) : null}
      {swipeLeft && !pending ? (
        <SwipeAction
          action={swipeLeft}
          side="right"
          open={offset <= -REVEAL / 2}
          onDone={close}
        />
      ) : null}

      <div
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={cn(
          "bg-surface relative transition-transform",
          drag.current && "transition-none",
          pending && "opacity-60",
        )}
      >
        {interactive}

        {hoverActions ? (
          // Only where there is a pointer to hover with, and only as a
          // duplicate of what the menu already offers.
          <div className="absolute inset-y-0 right-2 hidden items-center gap-1 group-hover:flex focus-within:flex max-lg:!hidden">
            {hoverActions}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!menu?.length) return row;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={pending}>
        {row}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menu.map((item) => (
          <ContextMenuItem
            key={item.label}
            tone={item.tone}
            onSelect={item.onAction}
          >
            <item.icon aria-hidden="true" />
            {item.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The button a swipe uncovers, parked against one edge. */
function SwipeAction({
  action,
  side,
  open,
  onDone,
}: {
  action: RowAction;
  side: "left" | "right";
  open: boolean;
  onDone: () => void;
}) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      tabIndex={open ? 0 : -1}
      aria-hidden={!open}
      onClick={() => {
        onDone();
        action.onAction();
      }}
      className={cn(
        "absolute inset-y-0 flex w-[88px] flex-col items-center justify-center gap-0.5 text-xs font-semibold",
        side === "left" ? "left-0" : "right-0",
        action.tone === "destructive"
          ? "bg-tint-rose text-expense"
          : "bg-accent text-text",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {action.label}
    </button>
  );
}
