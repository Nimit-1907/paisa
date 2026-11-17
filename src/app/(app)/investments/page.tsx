import type { Metadata } from "next";

import { InvestmentsScreen } from "@/components/investments/investments-screen";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import {
  getInvestedSince,
  getInvestmentGoals,
  getInvestments,
} from "@/lib/queries/investments";
import { localToday } from "@/lib/recurring-check";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const profile = await getProfile();
  const today = localToday(profile?.timezone ?? DEFAULT_TIME_ZONE);

  const [investments, goals, investedThisMonth] = await Promise.all([
    getInvestments(),
    getInvestmentGoals(),
    getInvestedSince(`${today.slice(0, 8)}01`),
  ]);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Investments"
        description="Money in and out, by goal"
      />

      <InvestmentsScreen
        investments={investments}
        goals={goals}
        investedThisMonth={investedThisMonth}
        today={today}
      />
    </PageShell>
  );
}
