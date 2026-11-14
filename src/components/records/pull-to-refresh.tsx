"use client";

import * as React from "react";

import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** How far the finger has to travel before a release counts as a refresh. */
const THRESHOLD = 72;

/** Past this the indicator stops following, so the stretch has an end. */
const MAX = 96;

/**
 * Pull down at the top of the list to reload it.
 *
 * The gesture people already use for this on a phone, and the only way to
 * say "check again" without putting a button on a screen that does not need
 * one. It only engages when the page is already scrolled to the top and the
 * drag is clearly vertical, so an ordinary scroll and a horizontal swipe on
 * a row both still work.
 *
 * Resistance is deliberate: the indicator moves at a third of the finger's
 * speed and stops at 96px, which is what makes it feel attached to something
 * rather than loose.
 *
 * Touch only. A mouse has the browser's own reload, and a trackpad's inertia
 * would trigger this constantly.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const drag = React.useRef<{ startY: number; active: boolean } | null>(null);

  const ready = pull >= THRESHOLD;

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" || refreshing) return;
    if (window.scrollY > 0) return;

    drag.current = { startY: event.clientY, active: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state) return;

    const travelled = event.clientY - state.startY;

    // Upwards, or barely moved: leave it to the page to scroll.
    if (travelled <= 0) {
      if (!state.active) drag.current = null;
      return;
    }

    if (!state.active && travelled < 8) return;
    state.active = true;

    setPull(Math.min(MAX, travelled / 3));
  }

  /** The browser took the gesture over, so nothing was released. */
  function onPointerCancel() {
    drag.current = null;
    setPull(0);
  }

  async function onPointerUp() {
    const state = drag.current;
    drag.current = null;

    if (!state?.active) return;

    if (pull < THRESHOLD) {
      setPull(0);
      return;
    }

    setRefreshing(true);
    setPull(THRESHOLD);

    try {
      await onRefresh();
    } catch (thrown) {
      // These handlers are called as `void onPointerUp()`, so a rejection
      // here would be unhandled and the person would be left watching a
      // spinner disappear with nothing said.
      console.error("[records]", thrown);
      toast.error("Could not refresh. Check your connection.");
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }

  const showing = refreshing || pull > 0;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => void onPointerUp()}
      onPointerCancel={onPointerCancel}
      // Stops the browser's own overscroll from competing for the same
      // downward drag at the top of the list.
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div
        aria-hidden={!refreshing}
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: showing ? pull : 0,
          // While the finger is down the indicator tracks it exactly; the
          // spring back is the only part that is animated.
          transition: drag.current || reduced ? undefined : "height 200ms cubic-bezier(0.2,0,0,1)",
        }}
      >
        <span
          className={cn(
            "text-muted-foreground flex items-center gap-2 text-xs font-semibold",
            ready && !refreshing && "text-primary",
          )}
        >
          {refreshing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Refreshing
            </>
          ) : (
            <>
              <RefreshCw
                className={cn(
                  "size-4 duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-safe:transition-transform motion-reduce:transition-none",
                  ready && "rotate-180",
                )}
                aria-hidden="true"
              />
              {ready ? "Release to refresh" : "Pull to refresh"}
            </>
          )}
        </span>
      </div>

      {/* A live region so the refresh is announced rather than only drawn. */}
      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? "Refreshing records" : ""}
      </span>

      {children}
    </div>
  );
}
