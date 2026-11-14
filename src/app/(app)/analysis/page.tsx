import type { Metadata } from "next";

import { ChartPie } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { getMonthContext } from "@/lib/month-param";

export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { month } = await getMonthContext(m);

  return (
    <>
      <PageHeader title="Analysis" monthNav={month} />
      <EmptyState
        icon={ChartPie}
        title="Nothing to chart yet"
        description="Spending by category, income vs expense and month-on-month trends show up here once you have a few records."
      />
    </>
  );
}
