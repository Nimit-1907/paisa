import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { BudgetsScreen } from "@/components/budgets/budgets-screen";
import { getMonthContext } from "@/lib/month-param";
import {
  getBudgetHints,
  getBudgetMonth,
  getBudgetableCategories,
} from "@/lib/queries/budgets";
import { localToday } from "@/lib/recurring-check";

export const metadata: Metadata = { title: "Budgets" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { month, timeZone } = await getMonthContext(m);

  // Days left and anything scheduled only mean something for the month the
  // user is actually living in.
  const isCurrentMonth =
    month.year === month.maxYear && month.month === month.maxMonth;

  // Strictly before the month we are in. A future month can have budgets,
  // "Apply to all future months" makes them, and nothing has been spent in
  // one yet, so "you stayed under budget" would be true of a month that has
  // not happened.
  const isPastMonth =
    month.year < month.maxYear ||
    (month.year === month.maxYear && month.month < month.maxMonth);

  const [data, categories, hints] = await Promise.all([
    getBudgetMonth({
      year: month.year,
      month: month.month,
      today: localToday(timeZone),
      isCurrentMonth,
    }),
    getBudgetableCategories(),
    getBudgetHints(month.year, month.month),
  ]);

  const key = `${month.year}-${String(month.month).padStart(2, "0")}`;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Budgets"
        description="Monthly spending limits"
        monthNav={month}
      />

      <BudgetsScreen
        month={key}
        monthLabel={MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`))}
        data={data}
        categories={categories}
        hints={hints}
        isPastMonth={isPastMonth}
      />
    </PageShell>
  );
}
