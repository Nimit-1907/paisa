import type { Metadata } from "next";

import { ChartPie } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Analysis" };

export default function AnalysisPage() {
  return (
    <>
      <PageHeader title="Analysis" month />
      <EmptyState
        icon={ChartPie}
        title="Nothing to chart yet"
        description="Spending by category, income vs expense and month-on-month trends show up here once you have a few records."
      />
    </>
  );
}
