import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { RecurringScreen } from "@/components/recurring/recurring-screen";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import { getRecurringRules } from "@/lib/queries/recurring";
import { localToday } from "@/lib/recurring-check";

export const metadata: Metadata = { title: "Recurring" };

export default async function RecurringPage() {
  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;

  const [rules, accounts, categories] = await Promise.all([
    getRecurringRules(),
    getActiveAccounts().then((result) => result.rows),
    getActiveCategories(),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Recurring"
        description="Rent, salary, subscriptions — anything that repeats."
      />

      <RecurringScreen
        rules={rules}
        today={localToday(timeZone)}
        accounts={toAccountOptions(accounts)}
        categories={toCategoryOptions(categories)}
      />
    </PageShell>
  );
}
