"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FILTER_PARAM_KEYS } from "@/lib/schemas/transactions";

/**
 * Drops the filter parameters and keeps everything else, the month above
 * all. Sending someone back to today's records because they cleared a filter
 * on September would be its own small betrayal.
 *
 * Shared by the filter sheet's "Clear all" and the empty state's button, so
 * the two cannot drift apart.
 */
export function useClearFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return () => {
    const next = new URLSearchParams(params.toString());
    for (const key of FILTER_PARAM_KEYS) next.delete(key);

    router.replace(
      next.toString() ? `${pathname}?${next.toString()}` : pathname,
      { scroll: false },
    );
  };
}

/**
 * Drops one filter rather than all of them.
 *
 * `value` matters for the multi-valued ones: `category=a,b,c` should lose
 * `b` and keep the rest, where `q` or `min` is simply removed. Without that
 * distinction, taking one category chip off would clear every category.
 */
export function useRemoveFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (key: string, value?: string) => {
    const next = new URLSearchParams(params.toString());

    if (value === undefined) {
      next.delete(key);
    } else {
      const rest = (next.get(key) ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item && item !== value);

      if (rest.length) next.set(key, rest.join(","));
      else next.delete(key);
    }

    router.replace(
      next.toString() ? `${pathname}?${next.toString()}` : pathname,
      { scroll: false },
    );
  };
}
