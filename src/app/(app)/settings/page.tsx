import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { findCurrency } from "@/lib/currencies";
import { formatWith } from "@/lib/money";
import { currencyOf, getProfile, getSessionUser } from "@/lib/profile";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);
  const currency = currencyOf(profile);
  const currencyName = findCurrency(currency.code)?.name ?? currency.code;

  return (
    <>
      <PageHeader title="Settings" description="Currency, theme and account" />

      <dl className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
        <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <dt className="text-sm font-medium">Signed in as</dt>
            <dd className="text-muted-foreground truncate text-xs">
              {profile?.display_name
                ? `${profile.display_name} · ${user?.email}`
                : user?.email}
            </dd>
          </div>
        </div>

        <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3">
          <div>
            <dt className="text-sm font-medium">Currency</dt>
            <dd className="text-muted-foreground text-xs">
              {currencyName} · {formatWith(currency, 123456n)}
            </dd>
          </div>
          <span className="amount text-lg font-semibold">
            {currency.symbol}
          </span>
        </div>

        <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3">
          <div>
            <dt className="text-sm font-medium">Appearance</dt>
            <dd className="text-muted-foreground text-xs">
              Light, dark or follow your device
            </dd>
          </div>
          <ThemeToggle />
        </div>

        <div
          id="export"
          className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3"
        >
          <div>
            <dt className="text-sm font-medium">Export PDF</dt>
            <dd className="text-muted-foreground text-xs">
              Monthly statement — Phase 5
            </dd>
          </div>
        </div>
      </dl>

      <SignOutButton className="mt-4 w-full" />
    </>
  );
}
