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

      <div className="bg-surface mb-4 flex items-center gap-3 rounded-card border px-4 py-3">
        <span className="bg-tint-peri text-text flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {(profile?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {profile?.display_name ?? "Your account"}
          </p>
          <p className="text-text-secondary truncate text-xs">
            {user?.email}
          </p>
        </div>
      </div>

      <ul className="bg-surface divide-hairline divide-y overflow-hidden rounded-card border">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hoverable:bg-surface-muted flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors  "
              >
                <span className="bg-surface-muted text-text-secondary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="text-text-secondary block truncate text-xs">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className="text-text-secondary size-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="bg-surface mt-4 flex items-center justify-between gap-3 rounded-card border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Appearance</p>
          <p className="text-text-secondary text-xs">
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
