import type { Metadata } from "next";

import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { InstallButton } from "@/components/pwa/install-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MORE_ITEMS } from "@/lib/nav";
import { getProfile, getSessionUser } from "@/lib/profile";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);

  return (
    <PageShell>
      <PageHeader title="More" />

      <div className="bg-card mb-4 flex items-center gap-3 rounded-card border px-4 py-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {profile?.display_name ?? "Your account"}
          </p>
          <p className="text-ink-2 truncate text-xs">
            {user?.email}
          </p>
        </div>
      </div>

      <ul className="bg-card divide-border divide-y overflow-hidden rounded-card border">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hoverable:bg-muted/60 focus-visible:ring-ring flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-muted text-ink-2 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="text-ink-2 block truncate text-xs">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className="text-ink-2 size-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="bg-card mt-4 flex items-center justify-between gap-3 rounded-card border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Appearance</p>
          <p className="text-ink-2 text-xs">
            Light, dark or follow your device
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-4 space-y-2">
        <InstallButton />
        <SignOutButton className="w-full" />
      </div>
    </PageShell>
  );
}
