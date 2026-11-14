import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/layout/page-header";
import { HapticsCard } from "@/components/settings/haptics-card";
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
    <>
      <PageHeader title="Settings" description={user.email ?? undefined} />

      <SettingsScreen
        profile={{
          displayName: profile?.display_name ?? "",
          email: user.email ?? "",
          currencyCode: profile?.currency_code ?? "INR",
          decimals: profile?.decimal_places ?? 2,
          weekStart: profile?.week_start ?? 1,
          theme,
        }}
      />

      <div className="mt-4">
        <HapticsCard enabled={profile?.haptics ?? true} />
      </div>

      <SignOutButton className="mt-4 w-full" />
    </>
  );
}
