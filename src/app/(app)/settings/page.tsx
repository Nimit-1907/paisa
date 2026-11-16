import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { PreferencesCard } from "@/components/settings/preferences-card";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { getProfile, getSessionUser } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);

  // The layout already guards this, but the form needs a user to be about.
  if (!user) redirect(LOGIN_PATH);

  const theme =
    profile?.theme === "light" || profile?.theme === "dark"
      ? profile.theme
      : "system";

  return (
    <PageShell>
      <PageHeader title="Settings" description="Profile and preferences" />

      <SettingsScreen
        profile={{
          displayName: profile?.display_name ?? "",
          email: user.email ?? "",
          currencyCode: profile?.currency_code ?? "INR",
          decimals: profile?.decimal_places ?? 2,
          weekStart: profile?.week_start ?? 1,
          theme,
        }}
        preferences={
          <PreferencesCard
            haptics={profile?.haptics ?? true}
            showPaise={profile?.show_paise ?? false}
          />
        }
      />
    </PageShell>
  );
}
