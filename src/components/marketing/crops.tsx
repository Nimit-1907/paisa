import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { cn } from "@/lib/utils";

/**
 * Small slices of the real screens, for the feature blocks.
 *
 * Phase 13 asks each feature block to carry a crop of the screen it is
 * describing. These are drawn from the app's own tokens rather than captured
 * as images, for the same reasons the hero preview is: a PNG is heavy, soft
 * at 3x unless it is heavier, stale the moment a colour changes, and, on the
 * one page where first paint is the whole job, the largest thing the browser
 * has to fetch. Three of them would have been three more render-blocking
 * requests on a page already missing its LCP target.
 *
 * Decorative. Each sits beside a heading and a paragraph that say the same
 * thing in words, so a screen reader is better served skipping it than
 * hearing a list of invented amounts.
 */

/**
 * The rupee sign, drawn.
 *
 * Inter has no U+20B9 in the subset the rest of this page needs, so a handful
 * of these characters pulled a second 85KB font file. The same mark as a path
 * costs nothing and is the shape lucide draws in the app itself.
 */
export function Rupee() {
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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="bg-background rounded-control pointer-events-none mb-4 overflow-hidden border p-2.5 select-none"
    >
      {children}
    </div>
  );
}

/** Records: three rows, the way the list actually reads. */
export function TrackCrop() {
  return (
    <Frame>
      <div className="space-y-1.5">
        {[
          {
            name: "Groceries",
            account: "Paytm Wallet",
            amount: "400",
            tint: "bg-tint-peach",
            icon: "ShoppingBasket",
          },
          {
            name: "Transport",
            account: "Metro card",
            amount: "60",
            tint: "bg-tint-sky",
            icon: "Bus",
          },
          {
            name: "Food",
            account: "ICICI Credit",
            amount: "484",
            tint: "bg-tint-rose",
            icon: "UtensilsCrossed",
          },
        ].map((row) => (
          <div
            key={row.name}
            className="bg-surface rounded-control flex items-center gap-2 border px-2 py-1.5"
          >
            {/* The same tinted square the app draws, not a coloured dot:
                this is a picture of the product, and a picture that does
                not match it is an advertisement. */}
            <span
              className={cn(
                "text-text flex size-5 shrink-0 items-center justify-center rounded-[6px]",
                row.tint,
              )}
            >
              <DynamicIcon name={row.icon} className="size-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold">
                {row.name}
              </span>
              <span className="text-text-secondary block truncate text-[9px]">
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
    </Frame>
  );
}

/** Budgets: the bar motif, one comfortable and one gone. */
export function BudgetCrop() {
  // The amount is split from its words so the rupee mark can be the drawn
  // one; the glyph itself would pull a second font file onto this page.
  const rows = [
    {
      name: "Food",
      before: "",
      amount: "2,300",
      after: "left",
      used: 62,
      tone: "bg-ink",
    },
    {
      name: "Transport",
      before: "Over by ",
      amount: "400",
      after: "",
      used: 100,
      tone: "bg-expense",
    },
    {
      name: "Shopping",
      before: "",
      amount: "900",
      after: "left",
      used: 84,
      tone: "bg-warning",
    },
  ];

  return (
    <Frame>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.name}
            className="bg-surface rounded-control border px-2 py-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold">{row.name}</span>
              <span className="text-text-secondary amount text-[9px] font-medium">
                {row.before}
                <Rupee />
                {row.amount}
                {row.after}
              </span>
            </div>
            <div className="bg-surface-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${row.tone}`}
                style={{ width: `${row.used}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Recurring: what is due, as a date badge and an amount. */
export function RecurringCrop() {
  const rows = [
    {
      day: "01",
      month: "Dec",
      name: "Rent",
      every: "Every month",
      amount: "22,000",
    },
    {
      day: "05",
      month: "Dec",
      name: "Internet",
      every: "Every month",
      amount: "1,199",
    },
    {
      day: "12",
      month: "Dec",
      name: "Gym",
      every: "Every month",
      amount: "1,500",
    },
  ];

  return (
    <Frame>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.name}
            className="bg-surface rounded-control flex items-center gap-2 border px-2 py-1.5"
          >
            <span className="bg-surface-muted flex size-7 shrink-0 flex-col items-center justify-center rounded-control leading-none">
              <span className="text-[10px] font-semibold tabular-nums">
                {row.day}
              </span>
              {/* ink-2, not ink-3: ink-3 measures 4.17:1 on a muted
                  surface, which is under the 4.5 this text needs, and axe
                  says so. */}
              <span className="text-text-secondary text-[7px] font-semibold">
                {row.month}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold">
                {row.name}
              </span>
              <span className="text-text-secondary block truncate text-[9px]">
                {row.every}
              </span>
            </span>
            <span className="amount text-[11px] font-semibold">
              <Rupee />
              {row.amount}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
