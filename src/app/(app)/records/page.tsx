import type { Metadata } from "next";

import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSummary } from "@/components/records/month-summary";

export const metadata: Metadata = { title: "Records" };

export default function RecordsPage() {
  return (
    <>
      <PageHeader title="Records" month />
      <div className="space-y-4">
        <MonthSummary />
        <EmptyState
          icon={Receipt}
          title="No records this month"
          description="Tap the + button to log your first expense, income or transfer."
        />
      </div>
    </>
  );
}
