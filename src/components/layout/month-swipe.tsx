"use client";

import * as React from "react";

import { type MonthBounds, useMonthNav } from "@/hooks/use-month-nav";

/** How far a thumb has to travel across the header to count as a swipe. */
const THRESHOLD = 56;
/** Movement before the gesture commits to an axis. */
const AXIS_LOCK = 10;

/**
 * Swiping across the header changes the month.
 *
 * The stepper arrows are 44px targets at the top-right of the screen, which
 * is the hardest place on a phone for a right thumb to reach, and stepping
 * back through a few months is the one thing people do over and over on this
 * screen. The swipe is the shortcut; the arrows stay exactly where they were.
 *
 * Left for the next month, right for the previous one: the direction the
 * content would travel, which is the convention every calendar and photo
 * roll already taught.
 */
export function MonthSwipe({
  children,
  ...bounds
}: MonthBounds & { children: React.ReactNode }) {
  const { step, isCurrent } = useMonthNav(bounds);

  const drag = React.useRef<{
    startX: number;
    startY: number;
    axis: "none" | "x" | "y";
    fired: boolean;
  } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Thumbs only. A mouse drag across a header is a text selection.
    if (event.pointerType === "mouse") {
      drag.current = null;
      return;
    }
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      axis: "none",
      fired: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.fired) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.axis === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      // A vertical drag on a sticky header is a page scroll, and taking it
      // over would make the whole screen feel stuck.
      if (state.axis === "y") drag.current = null;
      return;
    }

    if (Math.abs(dx) < THRESHOLD) return;

    // Once per gesture: a long drag should move one month, not four.
    state.fired = true;

    if (dx < 0) {
      if (!isCurrent) step(1);
    } else {
      step(-1);
    }
  }

  function end() {
    drag.current = null;
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
    </div>
  );
}
