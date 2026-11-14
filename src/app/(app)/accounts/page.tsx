import type { Metadata } from "next";

import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Cash, bank and wallet balances"
      />
      <EmptyState
        icon={Wallet}
        title="No accounts yet"
        description="Add Cash, a bank account or a UPI wallet, then every record can move money between them."
        action={
          <Button size="touch" disabled>
            Add account
          </Button>
        }
      />
    </>
  );
}
