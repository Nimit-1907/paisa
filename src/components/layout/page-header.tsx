import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { MonthSwipe } from "@/components/layout/month-swipe";
import { MonthSwitcher } from "@/components/layout/month-switcher";
import { OfflinePill } from "@/components/shared/offline-pill";
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
  /** Back link, for a detail screen. */
  back?: { href: string; label: string };
  /**
   * The summary strip that replaces the hero once it has scrolled away.
   * Rendered only when `compactShown` is true; see `CollapsingHeader`.
   */
  compact?: React.ReactNode;
  compactShown?: boolean;
  className?: string;
};

/**
 * Sticky page header — the same structure on every screen.
 *
 * Bleeds past the page gutter (`-mx-4`) so the blurred background spans the
 * full width, and respects the notch via `pt-safe`.
 *
 * The title is set in the anchor serif: Phase 13 gives the serif the hero
 * figure and the page title, which are the two things on a screen that say
 * where you are and what you came for.
 */
export function PageHeader({
  title,
  description,
  actions,
  monthNav,
  back,
  compact,
  compactShown = false,
  className,
}: PageHeaderProps) {
  const inner = (
    <div className="pt-safe">
      <div className="flex min-h-14 items-center justify-between gap-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="text-ink-2 hoverable:bg-muted focus-visible:ring-ring -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : null}
          <h1 className="font-display truncate text-2xl leading-tight tracking-tight">
            {title}
          </h1>
          <OfflinePill className="ml-1" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {monthNav ? <MonthSwitcher {...monthNav} /> : null}
          {actions}
        </div>
      </div>

      {description && !monthNav ? (
        <p className="text-ink-2 -mt-1 pb-3 text-sm">{description}</p>
      ) : null}

      {compact ? (
        <div
          // Height and opacity rather than mounting: a strip that appears
          // from nothing nudges the whole page down by its own height the
          // moment it arrives, which is a layout shift caused by scrolling.
          className={cn(
            "overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            compactShown ? "mb-2 max-h-16 opacity-100" : "max-h-0 opacity-0",
          )}
          aria-hidden={!compactShown}
        >
          {compact}
        </div>
      ) : null}
    </div>
  );

  return (
    <header
      className={cn(
        "glass sticky top-0 z-30 -mx-4 mb-4 border-b px-4 lg:-mx-6 lg:px-6",
        className,
      )}
    >
      {/* A month-scoped header is swipeable; the rest have nothing to step. */}
      {monthNav ? <MonthSwipe {...monthNav}>{inner}</MonthSwipe> : inner}
    </header>
  );
}
