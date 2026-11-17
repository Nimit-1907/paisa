import type { Metadata } from "next";

import { GrowthScreen } from "@/components/investments/growth-screen";
import { InvestmentsTabs } from "@/components/investments/investments-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { getInvestmentGoals, getInvestments } from "@/lib/queries/investments";
import { investmentsToday } from "@/lib/queries/investments-today";

export const metadata: Metadata = { title: "Growth" };

export default async function GrowthPage() {
  const [today, investments, goals] = await Promise.all([
    investmentsToday(),
    getInvestments(),
    getInvestmentGoals(),
  ]);

  return (
    <PageShell>
      <PageHeader title="Growth" description="What goes in, years ahead" />
      <div className="space-y-6">
        <InvestmentsTabs />
        <GrowthScreen investments={investments} goals={goals} today={today} />
      </div>
    </PageShell>
  );
}
