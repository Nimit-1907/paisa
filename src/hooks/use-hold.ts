"use client";

import * as React from "react";

import { holdStarts, movedPastSlop } from "@/lib/hold";

/**
 * A press held for `ms` runs `onHold`; the click that ends it does not
 * also count as a tap.
 *
 * Shared by the keypad's ⌫ (hold to clear) and the quick-add chips (hold
 * to save), so a hold means the same length of time everywhere. Spread
 * `handlers` on the button and start its onClick with
 * `if (wasHeld()) return;`. Only the primary button of the primary
 * pointer starts one, and moving past a finger's wobble cancels it.
 */
export function useHold(onHold: () => void, ms = 500) {
  const timer = React.useRef<number | null>(null);
  const held = React.useRef(false);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const latest = React.useRef(onHold);
  latest.current = onHold;

  const stop = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  React.useEffect(() => stop, [stop]);

  const handlers = {
    onPointerDown: (event: React.PointerEvent) => {
      held.current = false;
      stop();
      if (!holdStarts(event)) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        held.current = true;
        timer.current = null;
        latest.current();
      }, ms);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (
        start.current &&
        movedPastSlop(start.current, { x: event.clientX, y: event.clientY })
      ) {
        stop();
      }
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // Enter and Space click without a pointerdown: a hold that never got
    // its click must not swallow the next key press.
    onKeyDown: () => {
      held.current = false;
    },
  };

  /** True once, for the click that ends a hold. */
  function wasHeld() {
    if (!held.current) return false;
    held.current = false;
    return true;
  }

  return { handlers, wasHeld };
}
