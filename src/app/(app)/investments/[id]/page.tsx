import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { InvestmentDetail } from "@/components/investments/investment-detail";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { KIND_META } from "@/lib/investments";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import {
  getInvestment,
  getInvestmentEntries,
  getInvestmentGoals,
  isInvestmentId,
} from "@/lib/queries/investments";
import { localToday } from "@/lib/recurring-check";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const investment = isInvestmentId(id) ? await getInvestment(id) : null;
  return { title: investment?.name ?? "Investment" };
}

export default async function InvestmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payout?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  // A malformed id is a 404, not a 500: the path is user-typed.
  if (!isInvestmentId(id)) notFound();

  const [investment, entries, goals, profile] = await Promise.all([
    getInvestment(id),
    getInvestmentEntries(id),
    getInvestmentGoals(),
    getProfile(),
  ]);

  // RLS makes someone else's investment the same as one that is gone.
  if (!investment) notFound();

  const today = localToday(profile?.timezone ?? DEFAULT_TIME_ZONE);

  return (
    <PageShell>
      <PageHeader
        title={investment.name}
        description={[KIND_META[investment.kind].long, investment.platform]
          .filter(Boolean)
          .join(" · ")}
        back={{ href: "/investments/holdings", label: "Back to holdings" }}
      />

      <InvestmentDetail
        investment={investment}
        entries={entries}
        goals={goals}
        today={today}
        openPayout={query.payout === "1" && investment.status === "open"}
      />
    </PageShell>
  );
}
