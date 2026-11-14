import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { MonthRecap } from "@/components/records/month-recap";
import { RecordsScreen } from "@/components/records/records-screen";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import { getMonthContext, parseFilters } from "@/lib/month-param";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import { getMonthRecap } from "@/lib/queries/recap";
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
import { getProfile } from "@/lib/profile";
import { transactionFiltersSchema } from "@/lib/schemas/transactions";

export const metadata: Metadata = { title: "Records" };

/** "October" — the month the recap is about. */
function monthName(firstOfMonth: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
  }).format(new Date(`${firstOfMonth}T00:00:00Z`));
}

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
  const previousMonth = {
    year: month.month === 1 ? month.year - 1 : month.year,
    month: month.month === 1 ? 12 : month.month - 1,
  };
  const previousStart = `${previousMonth.year}-${String(previousMonth.month).padStart(2, "0")}-01`;

  /*
   * Last month's recap, on the first visit of the new one.
   *
   * Decided before it is started, so the queries only run on the days the
   * card can actually be shown, and started alongside the month's own
   * queries rather than after them, so it costs no round trip of its own.
   * getProfile() is cached per request and the layout has already awaited
   * it, so the guard itself is free.
   *
   * The catch matters: this promise is awaited after the others, and a
   * throw from the RPC in between would be an unhandled rejection. A recap
   * is the least important thing on the screen — it can be missing.
   */
  const profile = await getProfile();

  const wantsRecap =
    isCurrentMonth &&
    activeFilterCount === 0 &&
    profile?.recap_seen_for !== previousStart;

  const recapPromise = wantsRecap
    ? getMonthRecap(previousMonth.year, previousMonth.month).catch(
        (thrown: unknown) => {
          console.error("[records]", thrown);
          return null;
        },
      )
    : Promise.resolve(null);

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

  const recap = await recapPromise;

  return (
    <>
      <PageHeader title="Records" monthNav={month} />

      {recap ? (
        <div className="mb-4">
          <MonthRecap recap={recap} monthLabel={monthName(previousStart)} />
        </div>
      ) : null}

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
