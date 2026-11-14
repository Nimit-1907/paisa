"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom tab bar (mobile / tablet).
 *
 * Hidden at >= lg, where `SidebarNav` takes over. Each tab is a 44px+ tap
 * target and the bar sits above the iOS home bar via `pb-safe`.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
    >
      <ul className="px-safe pb-safe mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 min-w-11 flex-col items-center justify-center gap-1 text-label leading-none font-semibold transition-colors",
                  "focus-visible:ring-ring rounded-lg focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon
                    className="size-[22px]"
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden="true"
                  />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
