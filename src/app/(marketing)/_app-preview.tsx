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
            {/* The one number the screen is for. */}
            <div className="bg-card rounded-xl border px-3 py-2">
              <p className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
                Left this month
              </p>
              <p className="amount text-lg font-semibold">
                <Rupee />
                48,931
              </p>
              <p className="text-muted-foreground mt-0.5 flex gap-2 text-[9px]">
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

/**
 * The rupee sign, drawn.
 *
 * Inter has no U+20B9 in the subset the rest of this page needs, so five of
 * these characters were pulling a second 85KB font file — on the one page
 * where first paint matters most, and only for the mock-up. The same mark as
 * a path costs nothing and is the shape lucide draws in the app itself.
 */
function Rupee() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block size-[0.85em] align-[-0.08em]"
    >
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  );
}

const ROWS = [
  { name: "Groceries", account: "Paytm Wallet", amount: "400", color: "#22C55E" },
  { name: "Transport", account: "Metro card", amount: "500", color: "#0EA5E9" },
  { name: "Food", account: "ICICI Credit", amount: "484", color: "#F97316" },
];
