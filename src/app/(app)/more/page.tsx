import type { Metadata } from "next";

import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { MORE_ITEMS } from "@/lib/nav";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />

      <ul className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="bg-card mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Appearance</p>
          <p className="text-muted-foreground text-xs">
            Light, dark or follow your device
          </p>
        </div>
        <ThemeToggle />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Paisa · Phase 1 shell
      </p>
    </>
  );
}
