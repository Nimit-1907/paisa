import { currentMonth } from "@/lib/dates";

export type SelectedMonth = {
  year: number;
  month: number;
  /** The latest month worth offering: "now" where the user is. */
  maxYear: number;
  maxMonth: number;
};

/**
 * Reads `?m=2026-11`, falling back to the month the user is currently in.
 *
 * Anything unparseable or in the future falls back too — the parameter comes
 * from the URL bar, and a month in 1823 is not worth a query.
 */
export function selectedMonth(
  value: string | undefined,
  timeZone: string,
): SelectedMonth {
  const now = currentMonth(timeZone);
  const fallback = {
    year: now.year,
    month: now.month,
    maxYear: now.year,
    maxMonth: now.month,
  };

  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return fallback;
  if (year < 1970 || year > now.year + 1) return fallback;
  if (year * 12 + month > now.year * 12 + now.month) return fallback;

  return { ...fallback, year, month };
}

/** `?q=`, `?type=`, … into the filter object the query understands. */
export function parseFilters(params: Record<string, string | undefined>) {
  const list = (value: string | undefined) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

  const types = list(params.type)?.filter(
    (value): value is "expense" | "income" | "transfer" =>
      value === "expense" || value === "income" || value === "transfer",
  );

  return {
    search: params.q?.trim() || undefined,
    types: types?.length ? types : undefined,
    accountIds: list(params.account),
    categoryIds: list(params.category),
    minAmount: params.min?.trim() || undefined,
    maxAmount: params.max?.trim() || undefined,
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to : undefined,
  };
}
