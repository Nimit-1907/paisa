import type { Metadata } from "next";

import { Target } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return (
    <>
      <PageHeader title="Budgets" month />
      <EmptyState
        icon={Target}
        title="No budgets set"
        description="Set a monthly limit per category and track how much is left at a glance."
        action={
          <Button size="touch" disabled>
            Set a budget
          </Button>
        }
      />
    </>
  );
}
