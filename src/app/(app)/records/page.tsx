import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { RecordsScreen } from "@/components/records/records-screen";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import { countFilters } from "@/lib/filter-summary";
import { parseFilters } from "@/lib/filter-params";
import { getMonthContext } from "@/lib/month-param";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import {
  getCreatedOccurrences,
  getRecurringRules,
} from "@/lib/queries/recurring";
import {
  getMonthDays,
  getMonthRegret,
  getMonthSummary,
  getMonthTransactions,
} from "@/lib/queries/transactions";
import { addDays } from "@/lib/recurrence";
import { expenseThrough } from "@/lib/month-trend";
import { localToday } from "@/lib/recurring-check";
import { upcomingBetween } from "@/lib/recurring-rule";
import { transactionFiltersSchema } from "@/lib/schemas/transactions";

export const metadata: Metadata = { title: "Records" };

/*
 * No loading.tsx, on purpose. Records is where every session starts, and a
 * Suspense boundary here held the month's hero figure back until React
 * revealed it after hydration, which was the screen's largest paint. See
 * `components/layout/list-screen-skeleton.tsx`.
 */

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  const { month, timeZone, currency } = await getMonthContext(single.m);

  // Parsed through the same schema the actions use, so a hand-edited URL
  // cannot reach the query with something the filters do not allow.
  const parsedFilters = transactionFiltersSchema.safeParse(
    parseFilters(single),
  );
  const filters = parsedFilters.success ? parsedFilters.data : {};

  const activeFilterCount = countFilters(filters);

  // The week ahead is only shown on the month the user is actually in: on
  // October, "due in 3 days" would be about a month they are not looking at.
  const isCurrentMonth =
    month.year === month.maxYear && month.month === month.maxMonth;
  const today = localToday(timeZone);

  const weekAhead = addDays(today, 7);

  const rulesPromise = isCurrentMonth
    ? getRecurringRules()
    : Promise.resolve([]);

  // Which of those occurrences already have a record, so the week ahead never
  // offers "Pay now" for something already in the list below it. Chained
  // rather than awaited after the rest, so it overlaps the month's own
  // queries instead of adding a round trip to every page load. With no active
  // rules it answers without touching the database.
  const previousMonth = {
    year: month.month === 1 ? month.year - 1 : month.year,
    month: month.month === 1 ? 12 : month.month - 1,
  };

  const createdPromise = rulesPromise.then((loaded) =>
    getCreatedOccurrences(
      loaded.filter((rule) => rule.active).map((rule) => rule.id),
      today,
      weekAhead,
      timeZone,
    ),
  );

  const [
    page,
    summary,
    previousDays,
    regret,
    monthDays,
    accounts,
    categories,
    rules,
    created,
  ] = await Promise.all([
    getMonthTransactions({
      year: month.year,
      month: month.month,
      timeZone,
      decimals: currency.decimals,
      filters,
    }),
    getMonthSummary(month.year, month.month),
    // Last month day by day, for the trend pill on the month card. Already
    // in the same Promise.all, so it costs no extra round trip.
    getMonthDays(previousMonth.year, previousMonth.month),
    // What was marked "not worth it", for the line on the month card.
    getMonthRegret(month.year, month.month),
    // The shape of the month, for the bars on the card.
    getMonthDays(month.year, month.month),
    getActiveAccounts().then((result) => result.rows),
    getActiveCategories(),
    rulesPromise,
    createdPromise,
  ]);

  // On the month you are in, last month counts only up to today's date:
  // the 1st to the 17th against the 1st to the 17th, not against all 31.
  const previousExpense = expenseThrough(
    previousDays,
    isCurrentMonth ? Number(today.slice(8, 10)) : null,
  );

  const upcoming = isCurrentMonth
    ? upcomingBetween(rules, today, weekAhead, created)
    : [];

  // The header and the month card are rendered by the screen
  // rather than here: the header collapses the card into a one-line summary
  // once it scrolls away, which means it has to know where the card ends.
  return (
    // Reading width, and on a wide screen room for the record panel too.
    <PageShell className="lg:max-w-[1200px]">
      <RecordsScreen
        year={month.year}
        month={month.month}
        timeZone={timeZone}
        rows={page.rows}
        hasMore={page.hasMore}
        summary={{
          income: summary.income.toString(),
          expense: summary.expense.toString(),
          net: summary.net.toString(),
        }}
        monthDays={monthDays}
        previousExpense={previousExpense.toString()}
        regret={regret.toString()}
        monthKey={`${month.year}-${String(month.month).padStart(2, "0")}`}
        accounts={toAccountOptions(accounts)}
        categories={toCategoryOptions(categories)}
        filters={filters}
        activeFilterCount={activeFilterCount}
        upcoming={upcoming}
        today={today}
        monthNav={month}
      />
    </PageShell>
  );
}
