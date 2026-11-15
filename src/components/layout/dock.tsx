"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChartPie, Plus, Receipt, Target, Wallet } from "lucide-react";

import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { isNavItemActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The floating dock: four destinations and the Add button between them.
 *
 * It replaces the Phase 13 bottom tab bar *and* the separate floating "+".
 * Those were two pieces of fixed furniture stacked on each other, which on
 * a 640px phone is a fifth of the screen spent on chrome — and the FAB sat
 * over the last row of every list.
 *
 * The active item is an ink pill with its icon and label; the others are
 * icon only, named by `aria-label`. That is the reference's arrangement,
 * and it is what lets five items fit at 360px without truncating.
 */
const DOCK_ITEMS: NavItem[] = [
  { href: "/records", label: "Records", icon: Receipt },
  { href: "/analysis", label: "Analysis", icon: ChartPie },
  { href: "/budgets", label: "Budgets", icon: Target },
  {
    href: "/accounts",
    label: "Accounts",
    icon: Wallet,
    owns: ["/about", "/categories", "/export", "/more", "/recurring", "/settings"],
  },
];

export function Dock() {
  const pathname = usePathname();
  const sheet = useRecordSheet();

  // Two on each side of the Add button.
  const left = DOCK_ITEMS.slice(0, 2);
  const right = DOCK_ITEMS.slice(2);

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
    >
      <div className="bg-surface rounded-dock mx-auto flex max-w-md items-center gap-1 border p-1.5">
        {left.map((item) => (
          <DockLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/*
          The one accent in the dock. 46px square at 15px radius, periwinkle,
          with the small hard shadow — the only element here that is not
          flat, because it is the only one that is not navigation.
        */}
        <button
          type="button"
          onClick={() => sheet.openAdd()}
          disabled={!sheet.ready}
          aria-label="Add record"
          className={cn(
            "bg-accent text-text accent-sm pressable-lg mx-0.5 flex size-[46px] shrink-0 items-center justify-center rounded-[15px]",
            "disabled:opacity-50",
          )}
        >
          <Plus className="size-[22px]" aria-hidden="true" strokeWidth={2.4} />
        </button>

        {right.map((item) => (
          <DockLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function DockLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // The label is in the markup either way: visible on the active item,
      // and a screen-reader-only name on the rest. An icon-only link whose
      // name lives in a title attribute is a link with no name.
      aria-label={active ? undefined : item.label}
      className={cn(
        // The active item sizes to its label and the rest share what is
        // left. Equal flex gives every item a quarter of the track, which
        // at 360px is not enough for "Accounts" and truncates it to "A...".
        "flex h-11 items-center justify-center gap-1.5 rounded-[15px] text-[13px] font-semibold",
        active ? "shrink-0 px-3" : "min-w-11 flex-1 px-2",
        "duration-[120ms] transition-colors motion-reduce:transition-none",
        active
          ? "bg-ink text-on-ink"
          : "text-text-secondary hoverable:text-text",
      )}
    >
      <Icon className="size-[19px] shrink-0" aria-hidden="true" />
      {active ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
