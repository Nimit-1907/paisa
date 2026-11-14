"use client";

import * as React from "react";

/**
 * Subscribes to a CSS media query.
 *
 * Returns `false` on the server and during the first client render, so always
 * design the mobile branch as the default (CLAUDE.md: mobile first).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — where the bottom bar becomes a sidebar. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
