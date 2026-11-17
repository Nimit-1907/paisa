import type { Metadata } from "next";

import { HoldingsScreen } from "@/components/investments/holdings-screen";
import { InvestmentsTabs } from "@/components/investments/investments-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { getInvestmentGoals, getInvestments } from "@/lib/queries/investments";
import { investmentsToday } from "@/lib/queries/investments-today";

export const metadata: Metadata = { title: "Holdings" };

export default async function HoldingsPage() {
  const [today, investments, goals] = await Promise.all([
    investmentsToday(),
    getInvestments(),
    getInvestmentGoals(),
  ]);

  return (
    <PageShell>
      <PageHeader title="Holdings" description="Every investment, by kind" />
      <div className="space-y-6">
        <InvestmentsTabs />
        <HoldingsScreen investments={investments} goals={goals} today={today} />
      </div>
    </PageShell>
  );
}
