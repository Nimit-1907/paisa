"use client";

import * as React from "react";

/**
 * A press held for `ms` runs `onHold`; the click that ends it does not
 * also count as a tap.
 *
 * Shared by the keypad's ⌫ (hold to clear) and the quick-add chips (hold
 * to save), so a hold means the same length of time everywhere. Spread
 * `handlers` on the button and start its onClick with
 * `if (wasHeld()) return;`.
 */
export function useHold(onHold: () => void, ms = 500) {
  const timer = React.useRef<number | null>(null);
  const held = React.useRef(false);
  const latest = React.useRef(onHold);
  latest.current = onHold;

  const stop = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  React.useEffect(() => stop, [stop]);

  const handlers = {
    onPointerDown: () => {
      held.current = false;
      stop();
      timer.current = window.setTimeout(() => {
        held.current = true;
        timer.current = null;
        latest.current();
      }, ms);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };

  /** True once, for the click that ends a hold. */
  function wasHeld() {
    if (!held.current) return false;
    held.current = false;
    return true;
  }

  return { handlers, wasHeld };
}
