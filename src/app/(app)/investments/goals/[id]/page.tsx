import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { GoalDetail } from "@/components/investments/goal-detail";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getInvestmentGoals,
  getInvestments,
  isInvestmentId,
} from "@/lib/queries/investments";
import { investmentsToday } from "@/lib/queries/investments-today";

/** `none` is the investments with no goal; anything else is a goal's id. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === "none") return { title: "No goal" };
  if (!isInvestmentId(id)) return { title: "Goal" };
  const goal = (await getInvestmentGoals()).find((g) => g.id === id);
  return { title: goal?.name ?? "Goal" };
}

export default async function GoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id !== "none" && !isInvestmentId(id)) notFound();

  const [today, investments, goals] = await Promise.all([
    investmentsToday(),
    getInvestments(),
    getInvestmentGoals(),
  ]);

  const goal = id === "none" ? null : (goals.find((g) => g.id === id) ?? null);
  if (id !== "none" && !goal) notFound();

  const known = new Set(goals.map((g) => g.id));
  const mine = investments.filter((investment) =>
    goal
      ? investment.goalId === goal.id
      : !investment.goalId || !known.has(investment.goalId),
  );

  return (
    <PageShell>
      <PageHeader
        title={goal?.name ?? "No goal"}
        description={
          goal
            ? goal.targetAmount
              ? `Target ${formatTarget(goal.targetAmount)}`
              : "No target set"
            : "Investments without a goal"
        }
        back={{ href: "/investments/goals", label: "Back to goals" }}
      />
      <GoalDetail goal={goal} investments={mine} goals={goals} today={today} />
    </PageShell>
  );
}

/** Whole rupees for the header; the hero below has the exact figure. */
function formatTarget(minor: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;
}
