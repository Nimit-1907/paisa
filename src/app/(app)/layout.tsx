import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
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
  const [accounts, categories, created, entryDefaults, quickAdds] =
    await Promise.all([
      getActiveAccounts(),
      getActiveCategories(),
      runDueRecurring(),
      getEntryDefaults(),
      getQuickAdds(),
    ]);

  return (
    <ProfileProvider
      currency={currencyOf(profile)}
      haptics={profile?.haptics ?? true}
    >
      <RecordSheetProvider
        timeZone={profile?.timezone ?? "Asia/Kolkata"}
        accounts={toAccountOptions(accounts)}
        categories={toCategoryOptions(categories)}
        entryDefaults={entryDefaults}
        quickAdds={quickAdds}
        firstRecordSeen={profile?.first_record_seen ?? true}
      >
        <div className="min-h-dvh">
          <SkipLink />
          <SidebarNav />

          <div className="lg:pl-64">
            <main
              id="main"
              className="pb-nav mx-auto w-full max-w-3xl px-4 lg:px-6 lg:pb-16"
            >
              {children}
            </main>
          </div>

          <BottomNav />
          <AddRecordFab />
          <RecurringCreatedToast created={created} />
        </div>
      </RecordSheetProvider>
    </ProfileProvider>
  );
}
