"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IndianRupee, type LucideIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  MORE_ITEMS,
  NAV_ITEMS,
  isNavItemActive,
  isPathActive,
} from "@/lib/nav";
import { cn } from "@/lib/utils";

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
          "",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-text-secondary hoverable:bg-sidebar-accent/50 hoverable:text-sidebar-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        {label}
      </Link>
    </li>
  );
}

/** Left sidebar shown from `lg` up, replacing the bottom tab bar. */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r lg:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <span className="bg-ink text-on-ink flex size-9 items-center justify-center rounded-control">
          <IndianRupee className="size-5" aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">Paisa</p>
          <p className="text-text-secondary text-xs">Expense tracker</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavItemActive(item, pathname, {
                includeOwned: false,
              })}
            />
          ))}
        </ul>

        <p className="text-text-secondary mt-6 px-3 text-xs font-semibold ">
          Manage
        </p>
        <ul className="mt-1 space-y-1">
          {MORE_ITEMS.filter((item) => !item.href.includes("#")).map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isPathActive(item.href, pathname)}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t p-3">
        <ThemeToggle className="w-full justify-between" />
      </div>
    </aside>
  );
}
