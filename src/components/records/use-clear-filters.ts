"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FILTER_PARAM_KEYS } from "@/lib/schemas/transactions";

/**
 * Drops the filter parameters and keeps everything else — the month above
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
