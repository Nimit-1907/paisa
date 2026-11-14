import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { RecordsScreen } from "@/components/records/records-screen";
import { getMonthContext, parseFilters } from "@/lib/month-param";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import {
  getMonthSummary,
  getMonthTransactions,
} from "@/lib/queries/transactions";
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

  const [page, summary, accounts, categories] = await Promise.all([
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
  ]);

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
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          icon: account.icon,
          color: account.color,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          kind: category.kind,
        }))}
        filters={filters}
        activeFilterCount={activeFilterCount}
      />
    </>
  );
}
