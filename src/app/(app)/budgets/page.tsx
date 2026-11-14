import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { BudgetsScreen } from "@/components/budgets/budgets-screen";
import { getMonthContext } from "@/lib/month-param";
import { getBudgetMonth, getBudgetableCategories } from "@/lib/queries/budgets";
import { localToday } from "@/lib/recurring-check";

export const metadata: Metadata = { title: "Budgets" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const SHORT_MONTH = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "short",
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

  const [data, categories] = await Promise.all([
    getBudgetMonth({
      year: month.year,
      month: month.month,
      timeZone,
      today: localToday(timeZone),
      isCurrentMonth,
    }),
    getBudgetableCategories(),
  ]);

  const key = `${month.year}-${String(month.month).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(month.year, month.month - 2, 1));

  return (
    <>
      <PageHeader title="Budgets" monthNav={month} />

      <BudgetsScreen
        month={key}
        monthLabel={MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`))}
        previousLabel={SHORT_MONTH.format(previous)}
        data={data}
        categories={categories}
      />
    </>
  );
}
