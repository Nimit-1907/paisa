import type { Metadata } from "next";

import Link from "next/link";

import { ChevronRight, User } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { InstallButton } from "@/components/pwa/install-button";
import { SectionHeader } from "@/components/shared/section-header";
import { HeroCard, ListCard } from "@/components/shared/surface";
import { MORE_ITEMS } from "@/lib/nav";
import { getProfile, getSessionUser } from "@/lib/profile";

export const metadata: Metadata = { title: "More" };

/**
 * The destinations, in the four groups the brief names.
 *
 * Built from `MORE_ITEMS` rather than beside it, so the sidebar and this
 * screen cannot drift apart about what a screen is called.
 */
type MoreItem = (typeof MORE_ITEMS)[number];

const BY_HREF = new Map<string, MoreItem>(
  MORE_ITEMS.map((item) => [item.href, item]),
);

const GROUPS: { title: string; items: MoreItem[] }[] = [
  { title: "Manage", hrefs: ["/investments", "/categories", "/recurring"] },
  { title: "Data", hrefs: ["/import", "/export"] },
  { title: "App", hrefs: ["/settings", "/about"] },
].map((group) => ({
  title: group.title,
  items: group.hrefs
    .map((href) => BY_HREF.get(href))
    .filter((item): item is MoreItem => Boolean(item)),
}));

export default async function MorePage() {
  const [profile, user] = await Promise.all([getProfile(), getSessionUser()]);

  // Two letters at most, as in the header's avatar.
  const initials = (profile?.display_name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <PageShell>
      <PageHeader title="More" description="Tools and settings" />

      {/* The one bold card: who is signed in. Everything below it is a
          place to go, and a list of destinations has no hero in it. */}
      <HeroCard className="flex items-center gap-3">
        <span className="bg-tint-peri text-text border-ink flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] text-base font-bold">
          {initials || <User className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="font-display truncate text-xl tracking-[-0.02em]">
            {profile?.display_name ?? "Your account"}
          </p>
          <p className="text-text-secondary truncate text-xs">{user?.email}</p>
        </div>
      </HeroCard>

      {/*
        From lg up the sidebar lists every one of these destinations and
        carries the theme toggle, so the page keeps only what the sidebar
        does not: who is signed in, and install.
      */}
      {GROUPS.map((group) => (
        <section key={group.title} className="mt-5 lg:hidden">
          <SectionHeader className="mb-1.5 px-1" title={group.title} />

          <ListCard>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hoverable:bg-surface-muted flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors"
                  >
                    <span className="bg-surface-muted text-text rounded-control flex size-9 shrink-0 items-center justify-center">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      {/* Wraps rather than cuts: the description is the
                          only thing saying what is behind the row. */}
                      <span className="text-text-secondary block text-xs">
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
          </ListCard>
        </section>
      ))}

      {/* Theme and Sign out live in Settings alone: one place for each,
          and this screen stays an index of where to go. Install is here
          because it is about the app on this device, not the account. */}
      <div className="mt-5">
        <InstallButton />
      </div>
    </PageShell>
  );
}
