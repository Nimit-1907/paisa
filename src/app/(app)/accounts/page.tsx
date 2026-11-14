import type { Metadata } from "next";

import { AccountsScreen } from "@/components/accounts/accounts-screen";
import type { AccountView } from "@/components/accounts/types";
import { PageHeader } from "@/components/layout/page-header";
import { getAccountsOverview } from "@/lib/queries/accounts";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const accounts = await getAccountsOverview();

  // Amounts become strings on the way to the client: the RSC payload is JSON,
  // which has no BigInt, and a number would silently become a float.
  const view: AccountView[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    color: account.color,
    initialBalance: String(account.initial_balance),
    balance: account.balance.toString(),
    includeInTotal: account.include_in_total,
    archived: account.archived,
    usageCount: account.usageCount,
  }));

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Cash, bank and wallet balances"
      />
      <AccountsScreen accounts={view} />
    </>
  );
}
