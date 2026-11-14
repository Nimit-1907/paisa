import { MonthSwitcher } from "@/components/layout/month-switcher";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Short line under the title (hidden when a month switcher is shown). */
  description?: string;
  /** Buttons rendered on the right of the title row. */
  actions?: React.ReactNode;
  /** Show the month stepper (Records, Analysis, Budgets). */
  monthNav?: {
    year: number;
    month: number;
    maxYear: number;
    maxMonth: number;
  };
  className?: string;
};

/**
 * Sticky page header.
 *
 * Bleeds past the page gutter (`-mx-4`) so the blurred background spans the
 * full width, and respects the notch via `pt-safe`.
 */
export function PageHeader({
  title,
  description,
  actions,
  monthNav,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "glass sticky top-0 z-30 -mx-4 mb-4 border-b px-4 lg:-mx-6 lg:px-6",
        className,
      )}
    >
      <div className="pt-safe">
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            {monthNav ? <MonthSwitcher {...monthNav} /> : null}
            {actions}
          </div>
        </div>
        {description && !monthNav ? (
          <p className="text-muted-foreground -mt-1 pb-3 text-sm">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}
