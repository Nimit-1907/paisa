import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_CURRENCY_SYMBOL, formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Currency, theme and data" />

      <dl className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
        <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3">
          <div>
            <dt className="text-sm font-medium">Currency</dt>
            <dd className="text-muted-foreground text-xs">
              Indian Rupee · {formatMoney(123456n, {
                symbol: DEFAULT_CURRENCY_SYMBOL,
              })}
            </dd>
          </div>
          <span className="amount text-lg font-semibold">
            {DEFAULT_CURRENCY_SYMBOL}
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
    </>
  );
}
