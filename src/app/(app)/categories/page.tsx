import type { Metadata } from "next";

import { CategoriesScreen } from "@/components/categories/categories-screen";
import type { CategoryView } from "@/components/categories/types";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { currentMonthRange } from "@/lib/dates";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import {
  getCategoriesOverview,
  getCategoryMonthTotals,
} from "@/lib/queries/categories";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const month = currentMonthRange(timeZone);

  const [categories, totals] = await Promise.all([
    getCategoriesOverview(),
    getCategoryMonthTotals(month.monthStart),
  ]);

  const view: CategoryView[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    color: category.color,
    tint: category.tint,
    archived: category.archived,
    usageCount: category.usageCount,
    transactionCount: category.transactionCount,
    monthTotal: totals ? (totals.get(category.id) ?? "0") : null,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Categories"
        description="How spending is grouped"
      />
      <CategoriesScreen categories={view} />
    </PageShell>
  );
}
