import type { Metadata } from "next";

import { GoalsScreen } from "@/components/investments/goals-screen";
import { InvestmentsTabs } from "@/components/investments/investments-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { getInvestmentGoals, getInvestments } from "@/lib/queries/investments";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const [investments, goals] = await Promise.all([
    getInvestments(),
    getInvestmentGoals(),
  ]);

  return (
    <PageShell>
      <PageHeader title="Goals" description="What your investments are for" />
      <div className="space-y-6">
        <InvestmentsTabs />
        <GoalsScreen investments={investments} goals={goals} />
      </div>
    </PageShell>
  );
}
