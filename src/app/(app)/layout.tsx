import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProfileProvider } from "@/components/profile-provider";
import { AddRecordFab } from "@/components/records/add-record-fab";
import { RecordSheetProvider } from "@/components/records/record-sheet-provider";
import {
  currencyOf,
  getProfile,
  getSessionUser,
  needsOnboarding,
} from "@/lib/profile";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
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
  const [accounts, categories] = await Promise.all([
    getActiveAccounts(),
    getActiveCategories(),
  ]);

  return (
    <ProfileProvider currency={currencyOf(profile)}>
      <RecordSheetProvider
        timeZone={profile?.timezone ?? "Asia/Kolkata"}
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          icon: account.icon,
          color: account.color,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          kind: category.kind,
        }))}
      >
        <div className="min-h-dvh">
          <SidebarNav />

          <div className="lg:pl-64">
            <main className="pb-nav mx-auto w-full max-w-3xl px-4 lg:px-6 lg:pb-16">
              {children}
            </main>
          </div>

          <BottomNav />
          <AddRecordFab />
        </div>
      </RecordSheetProvider>
    </ProfileProvider>
  );
}
