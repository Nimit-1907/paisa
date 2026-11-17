import type { Metadata } from "next";

import { InvestmentsTabs } from "@/components/investments/investments-tabs";
import { OverviewScreen } from "@/components/investments/overview-screen";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getInvestedSince,
  getInvestmentGoals,
  getInvestments,
} from "@/lib/queries/investments";
import { investmentsToday } from "@/lib/queries/investments-today";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const today = await investmentsToday();

  const [investments, goals, investedThisMonth] = await Promise.all([
    getInvestments(),
    getInvestmentGoals(),
    getInvestedSince(`${today.slice(0, 8)}01`),
  ]);

  return (
    <PageShell>
      <PageHeader title="Investments" description="Money in and out, by goal" />
      <div className="space-y-6">
        <InvestmentsTabs />
        <OverviewScreen
          investments={investments}
          goals={goals}
          investedThisMonth={investedThisMonth}
          today={today}
        />
      </div>
    </PageShell>
  );
}
