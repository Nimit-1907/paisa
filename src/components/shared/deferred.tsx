"use client";

import * as React from "react";

/**
 * Renders its children one idle moment after the screen has painted.
 *
 * For work that is costly and not what the screen is opened for: the
 * Analysis charts. Drawn in the same commit as everything else, three
 * recharts plots held a tap on the dock for 780ms on a mid-range phone
 * before the screen changed at all; deferred, the headline and the
 * figures switch in at once and the plots fill in a frame or two later.
 *
 * The placeholder takes the exact height of what replaces it, so nothing
 * moves when it does. On the server and on the first client render it is
 * the placeholder, so hydration matches.
 */
export function Deferred({
  children,
  placeholderClassName,
}: {
  children: React.ReactNode;
  /** The finished content's height, e.g. `h-[200px]`. */
  placeholderClassName: string;
}) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const show = () => React.startTransition(() => setReady(true));

    // Safari has no requestIdleCallback; a zero timeout still lets the
    // first commit paint before this one starts.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(show, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(show, 0);
    return () => window.clearTimeout(id);
  }, []);

  return ready ? (
    children
  ) : (
    <div aria-hidden="true" className={placeholderClassName} />
  );
}
