import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProfileProvider } from "@/components/profile-provider";
import { AddRecordFab } from "@/components/records/add-record-fab";
import {
  currencyOf,
  getProfile,
  getSessionUser,
  needsOnboarding,
} from "@/lib/profile";
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

  return (
    <ProfileProvider currency={currencyOf(profile)}>
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
    </ProfileProvider>
  );
}
