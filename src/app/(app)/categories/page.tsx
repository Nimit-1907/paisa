import type { Metadata } from "next";

import { Tags } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Group your spending the way you think about it"
      />
      <EmptyState
        icon={Tags}
        title="Default categories arrive with your account"
        description="Once sign-up is wired in (Phase 2), every new user gets a starter set — Food, Transport, Bills, Salary — to rename or reorder here."
      />
    </>
  );
}
