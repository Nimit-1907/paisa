import type { Metadata } from "next";

import { CategoriesScreen } from "@/components/categories/categories-screen";
import type { CategoryView } from "@/components/categories/types";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { getCategoriesOverview } from "@/lib/queries/categories";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await getCategoriesOverview();

  const view: CategoryView[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    color: category.color,
    archived: category.archived,
    usageCount: category.usageCount,
    transactionCount: category.transactionCount,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Categories"
        description="Group your spending the way you think about it"
      />
      <CategoriesScreen categories={view} />
    </PageShell>
  );
}
