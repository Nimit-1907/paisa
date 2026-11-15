"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type MonthBounds = {
  year: number;
  month: number;
  /** The latest month worth offering — "today" in the user's timezone. */
  maxYear: number;
  maxMonth: number;
};

/**
 * Moving between months, in one place.
 *
 * Three things change the month now — the stepper buttons, a swipe across the
 * header, and the arrow keys — and all three have to clamp at the current
 * month, keep the rest of the query string, and replace rather than push. The
 * first version of this lived inside the stepper, which is why the other two
 * did not exist.
 */
export function useMonthNav({ year, month, maxYear, maxMonth }: MonthBounds) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const isCurrent = year === maxYear && month === maxMonth;
  const latest = maxYear * 12 + (maxMonth - 1);

  const go = React.useCallback(
    (nextYear: number, nextMonth: number) => {
      // Clamped here rather than relying on a disabled button: a double tap
      // before the route re-renders would otherwise step into a future
      // month, which has nothing to show.
      const target = Math.min(nextYear * 12 + (nextMonth - 1), latest);

      const next = new URLSearchParams(params.toString());
      next.set(
        "m",
        `${Math.floor(target / 12)}-${String((target % 12) + 1).padStart(2, "0")}`,
      );

      // replace, not push: stepping through months should not fill the back
      // stack with every month visited on the way.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [latest, params, pathname, router],
  );

  const step = React.useCallback(
    (delta: number) => {
      const index = Math.max(0, year * 12 + (month - 1) + delta);
      go(Math.floor(index / 12), (index % 12) + 1);
    },
    [go, month, year],
  );

  return { go, step, isCurrent };
}
