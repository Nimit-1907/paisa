import { cn } from "@/lib/utils";

/**
 * How wide a screen is allowed to be, and where its gutters come from.
 *
 * The app shell used to cap every signed-in page at 768px. That is the right
 * measure for a screen you read down — a list of records, a form, a settings
 * page — and the wrong one for a screen you scan across: a donut, a trend
 * line and four stat tiles at 768px on a 1,440px display is a column of
 * cards with half the window empty beside it.
 *
 * So the cap moved out of the layout and into the page, which is the only
 * thing that knows which kind it is.
 *
 * - `reading` (the default) — 768px. Records, forms, settings, detail pages.
 * - `wide` — 1200px, for the bento grids on Analysis, Budgets and Accounts.
 *
 * The gutters live here too, because `PageHeader` bleeds past them with
 * `-mx-4 lg:-mx-6` to span the full width of whichever shell it is in. Those
 * two numbers have to agree, and they only can if one component owns both.
 */
export function PageShell({
  width = "reading",
  className,
  children,
}: {
  width?: "reading" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 lg:px-6",
        width === "reading" ? "max-w-3xl" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
