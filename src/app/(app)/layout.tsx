import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { SkipLink } from "@/components/layout/skip-link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProfileProvider } from "@/components/profile-provider";
import { AddRecordFab } from "@/components/records/add-record-fab";
import { RecordSheetProvider } from "@/components/records/record-sheet-provider";
import { RecurringCreatedToast } from "@/components/recurring/recurring-created-toast";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import {
  currencyOf,
  getProfile,
  getSessionUser,
  needsOnboarding,
} from "@/lib/profile";
import {
  getActiveAccounts,
  getEntryDefaults,
  getNoteSuggestions,
  getQuickAdds,
} from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import { runDueRecurring } from "@/lib/recurring-check";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/routes";

/**
 * App shell: bottom tab bar + FAB on phones, left sidebar from `lg` up, with
 * the content column capped at ~768px (CLAUDE.md).
 *
 * It is also the gate. Middleware already turns anonymous requests away, but
 * this layout is what every signed-in page renders through, so it is the one
 * place that can check the profile without a query per page.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([getSessionUser(), getProfile()]);

  if (!user) {
    redirect(LOGIN_PATH);
  }

  if (needsOnboarding(profile)) {
    redirect(ONBOARDING_PATH);
  }

  // Loaded once for the whole shell: the Add Record sheet opens from every
  // tab, and it needs something to put in its pickers wherever it is opened.
  //
  // The recurring catch-up rides along here because this layout is the one
  // thing every signed-in page renders through, and it only does any work on
  // the first page of a new day.
  const [accountData, categories, created, entryDefaults, quickAdds, noteHints] =
    await Promise.all([
      getActiveAccounts(),
      getActiveCategories(),
      runDueRecurring(),
      getEntryDefaults(),
      getQuickAdds(),
      getNoteSuggestions(),
    ]);

  return (
    <ProfileProvider
      currency={currencyOf(profile)}
      haptics={profile?.haptics ?? true}
      showPaise={profile?.show_paise ?? false}
    >
      <RecordSheetProvider
        timeZone={profile?.timezone ?? "Asia/Kolkata"}
        // With balances: this is the list the transfer sheet picks From
        // from, and it warns when an account cannot cover the amount.
        accounts={toAccountOptions(accountData.rows, { withBalances: true })}
        balancesKnown={accountData.balancesKnown}
        categories={toCategoryOptions(categories)}
        entryDefaults={entryDefaults}
        quickAdds={quickAdds}
        noteHints={noteHints}
        firstRecordSeen={profile?.first_record_seen ?? true}
      >
        <div className="min-h-dvh">
          <SkipLink />
          <SidebarNav />

          <div className="lg:pl-64">
            {/*
              No width or gutter here any more: each page says how wide it
              should be through `PageShell`, because a screen you read down
              and a screen you scan across want different answers.
            */}
            <main id="main" className="pb-nav w-full lg:pb-16">
              {children}
            </main>
          </div>

          <BottomNav />
          <AddRecordFab />
          <KeyboardShortcuts />
          <RecurringCreatedToast created={created} />
        </div>
      </RecordSheetProvider>
    </ProfileProvider>
  );
}
