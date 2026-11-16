import { redirect } from "next/navigation";

import { Dock } from "@/components/layout/dock";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { SkipLink } from "@/components/layout/skip-link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProfileProvider } from "@/components/profile-provider";
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
import { EMPTY_SHEET_DATA, type SheetData } from "@/lib/sheet-data";
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

  // The Add Record sheet's pickers, for every tab, started here and not
  // awaited: the page renders now and the sheet reads the promise with
  // use() when it arrives (RecordSheetProvider). Nobody opens the sheet in
  // the first 40ms, and every page used to wait those 40ms for it.
  //
  // A failure resolves, marked failed, rather than rejecting: Add says it
  // could not load and offers a retry, instead of the whole screen
  // becoming an error page over a picker.
  const sheetData: Promise<SheetData> = Promise.all([
    getActiveAccounts(),
    getActiveCategories(),
    getEntryDefaults(),
    getQuickAdds(),
    getNoteSuggestions(),
  ])
    .then(([accountData, categories, entryDefaults, quickAdds, noteHints]) => ({
      // With balances: this is the list the transfer sheet picks From
      // from, and it warns when an account cannot cover the amount.
      accounts: toAccountOptions(accountData.rows, { withBalances: true }),
      balancesKnown: accountData.balancesKnown,
      categories: toCategoryOptions(categories),
      entryDefaults,
      quickAdds,
      noteHints,
    }))
    .catch((thrown: unknown) => {
      console.error("[layout]", thrown);
      return { ...EMPTY_SHEET_DATA, failed: true };
    });

  // Still awaited: it is the one thing here that writes, it does nothing
  // (2ms) on any page but the first of a new day, and its toast says what
  // it posted.
  const created = await runDueRecurring();

  return (
    <ProfileProvider
      currency={currencyOf(profile)}
      haptics={profile?.haptics ?? true}
      showPaise={profile?.show_paise ?? false}
      displayName={profile?.display_name ?? ""}
      timeZone={profile?.timezone ?? "Asia/Kolkata"}
      weekStart={profile?.week_start ?? 1}
    >
      <RecordSheetProvider
        timeZone={profile?.timezone ?? "Asia/Kolkata"}
        data={sheetData}
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
            <main id="main" className="pb-dock w-full lg:pb-16">
              {children}
            </main>
          </div>

          {/* One piece of fixed furniture: the dock carries the Add
              button, so the separate FAB is gone. */}
          <Dock />
          <KeyboardShortcuts />
          <RecurringCreatedToast created={created} />
        </div>
      </RecordSheetProvider>
    </ProfileProvider>
  );
}
