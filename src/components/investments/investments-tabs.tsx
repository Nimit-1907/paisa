"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/investments", label: "Overview" },
  { href: "/investments/holdings", label: "Holdings" },
  { href: "/investments/goals", label: "Goals" },
  { href: "/investments/growth", label: "Growth" },
] as const;

/**
 * The four Investments screens, one tap apart.
 *
 * Shaped like the segmented control because it does the same job, picking
 * one view of the same money, but these are links: each screen has its own
 * address, so Back and a shared link land where they should.
 */
export function InvestmentsTabs() {
  const pathname = usePathname();

  const active = (href: string) =>
    href === "/investments"
      ? pathname === "/investments"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Investments"
      className="bg-surface-muted rounded-control grid grid-cols-4 gap-1 p-1"
    >
      {TABS.map((tab) => {
        const current = active(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-segment pressable flex h-11 items-center justify-center text-[13px] font-semibold",
              "duration-[220ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
              current
                ? "bg-surface accent-sm text-text"
                : "text-text-secondary border border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
