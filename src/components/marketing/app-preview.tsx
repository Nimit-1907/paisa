import { Rupee } from "@/components/marketing/crops";
import { colorNamed } from "@/lib/colors";

/**
 * The Records screen, drawn rather than photographed.
 *
 * A marketing page wants a picture of the app. A PNG of one is heavy, soft on
 * a 3x screen unless it is heavier still, dated the moment a colour token
 * changes, and the largest thing the browser has to fetch before the page can
 * finish painting. This is the same screen built from the same tokens: sharp
 * at any pixel density, right in both themes, a few kilobytes, and it cannot
 * drift from the product because it is made of the product's own values.
 *
 * Decorative: the hero says in words what this shows, so a screen reader is
 * better served by skipping it than by hearing a list of invented amounts.
 */
export function AppPreview() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none mx-auto w-[260px] select-none sm:w-[300px]"
    >
      <div className="border-foreground/15 bg-card rounded-[2rem] border-[6px] p-2 shadow-xl">
        <div className="bg-background overflow-hidden rounded-[1.5rem]">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-[13px] font-semibold tracking-tight">
              Records
            </span>
            <span className="text-muted-foreground text-[11px]">Nov 2026</span>
          </div>

          <div className="space-y-2.5 p-3">
            {/* The month card, the same shape it has inside the app. */}
            <div className="bg-card accent-wash relative overflow-hidden rounded-xl border px-3 py-2">
              <p className="text-ink-3 text-[9px] font-semibold tracking-[0.08em] uppercase">
                Left this month
              </p>
              <p className="font-display text-ink text-[22px] leading-none">
                <Rupee />
                48,931
              </p>
              <p className="text-ink-2 mt-1 flex gap-2 text-[9px]">
                <span>
                  <span className="text-income font-semibold">
                    ↙ <Rupee />
                    85,000
                  </span>{" "}
                  in
                </span>
                <span>
                  <span className="text-expense font-semibold">
                    ↗ <Rupee />
                    36,069
                  </span>{" "}
                  out
                </span>
              </p>

              {/* The bars: the same motif, the same scaling rule. */}
              <div className="mt-1.5 flex h-6 items-end gap-[2px]">
                {DAYS.map((spent, index) => (
                  <span
                    key={index}
                    className={
                      index === 14
                        ? "bg-primary flex-1 rounded-full"
                        : "bg-primary/25 flex-1 rounded-full"
                    }
                    style={{ height: `${Math.min(100, Math.max(8, spent))}%` }}
                  />
                ))}
              </div>
            </div>

            <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
              Today
            </p>

            <div className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
              {ROWS.map((row) => (
                <div key={row.name} className="flex items-center gap-2 px-2.5 py-2">
                  <span
                    className="size-6 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold">
                      {row.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-[9px]">
                      {row.account}
                    </span>
                  </span>
                  <span className="amount text-expense text-[11px] font-semibold">
                    −<Rupee />
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* The bottom bar and the button everything starts from. */}
          <div className="relative border-t px-3 py-2">
            <div className="flex justify-between">
              {["Records", "Analysis", "Budgets", "Accounts", "More"].map(
                (tab, index) => (
                  <span
                    key={tab}
                    className={
                      index === 0
                        ? "text-primary text-[8px] font-semibold"
                        : "text-muted-foreground text-[8px]"
                    }
                  >
                    {tab}
                  </span>
                ),
              )}
            </div>

            <span className="bg-primary text-primary-foreground absolute -top-8 right-3 flex size-9 items-center justify-center rounded-full text-lg leading-none shadow-lg">
              +
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A month with a rent day in it, already scaled. */
const DAYS = [
  18, 100, 12, 8, 26, 14, 48, 40, 10, 8, 22, 16, 11, 24, 32, 8, 15, 28, 10,
  62, 14, 8, 20, 16, 36, 12, 8, 26, 18, 8,
];

/** The same swatches the app uses: green, sky and orange from the palette. */
const ROWS = [
  { name: "Groceries", account: "Paytm Wallet", amount: "400", color: colorNamed("green") },
  { name: "Transport", account: "Metro card", amount: "500", color: colorNamed("sky") },
  { name: "Food", account: "ICICI Credit", amount: "484", color: colorNamed("orange") },
];
