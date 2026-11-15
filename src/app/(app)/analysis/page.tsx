import type { Metadata } from "next";

import { AnalysisScreen } from "@/components/analysis/analysis-screen";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { parsePeriod } from "@/lib/period";
import { getProfile } from "@/lib/profile";
import { getAnalysis, getBalanceAccounts } from "@/lib/queries/analysis";
import { isUuid } from "@/lib/queries/recurring";
import { localToday } from "@/lib/recurring-check";

export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({
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

  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const weekStart = profile?.week_start ?? 1;
  const today = localToday(timeZone);

  // Everything is read off the URL and checked: these come from the address
  // bar, and a range of several centuries is not worth a query.
  const period = parsePeriod(single, today, weekStart);
  const kind = single.t === "income" ? "income" : "expense";
  const accountId = isUuid(single.a ?? "") ? (single.a as string) : null;

  const [data, accounts] = await Promise.all([
    getAnalysis({ period, kind, accountId, today }),
    getBalanceAccounts(),
  ]);

  return (
    <PageShell width="wide">
      <PageHeader title="Analysis" description="Where your money goes" />

      <AnalysisScreen
        period={period}
        kind={kind}
        data={data}
        accounts={accounts}
        accountId={accountId}
        today={today}
        weekStart={weekStart}
      />
    </PageShell>
  );
}
