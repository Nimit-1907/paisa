import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { RecordsScreen } from "@/components/records/records-screen";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import { getMonthContext, parseFilters } from "@/lib/month-param";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import {
  getCreatedOccurrences,
  getRecurringRules,
} from "@/lib/queries/recurring";
import {
  getMonthSummary,
  getMonthTransactions,
} from "@/lib/queries/transactions";
import { addDays } from "@/lib/recurrence";
import { localToday } from "@/lib/recurring-check";
import { upcomingBetween } from "@/lib/recurring-rule";
import { transactionFiltersSchema } from "@/lib/schemas/transactions";

export const metadata: Metadata = { title: "Records" };

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
  const parsedFilters = transactionFiltersSchema.safeParse(parseFilters(single));
  const filters = parsedFilters.success ? parsedFilters.data : {};

  const activeFilterCount = Object.values(filters).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  ).length;

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
  const createdPromise = rulesPromise.then((loaded) =>
    getCreatedOccurrences(
      loaded.filter((rule) => rule.active).map((rule) => rule.id),
      today,
      weekAhead,
      timeZone,
    ),
  );

  const [page, summary, accounts, categories, rules, created] =
    await Promise.all([
      getMonthTransactions({
        year: month.year,
        month: month.month,
        timeZone,
        decimals: currency.decimals,
        filters,
      }),
      getMonthSummary(month.year, month.month),
      getActiveAccounts(),
      getActiveCategories(),
      rulesPromise,
      createdPromise,
    ]);

  const upcoming = isCurrentMonth
    ? upcomingBetween(rules, today, weekAhead, created)
    : [];

  return (
    <>
      <PageHeader title="Records" monthNav={month} />

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
        accounts={toAccountOptions(accounts)}
        categories={toCategoryOptions(categories)}
        filters={filters}
        activeFilterCount={activeFilterCount}
        upcoming={upcoming}
        today={today}
      />
    </>
  );
}
