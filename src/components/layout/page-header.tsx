import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import {
  HeaderLogo,
  HeaderProfile,
  HeaderSearch,
} from "@/components/layout/header-chrome";
import { MonthSwipe } from "@/components/layout/month-swipe";
import { MonthSwitcher } from "@/components/layout/month-switcher";
import { OfflinePill } from "@/components/shared/offline-pill";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** The line under the title. Every screen has one. */
  description: string;
  /**
   * Anything that belongs to this screen alone, placed before search and
   * the profile. Keep it to one control: on a 360px phone the title needs
   * the rest of the row.
   */
  actions?: React.ReactNode;
  /** Search in place (Records). Without it, search links to Records. */
  onSearch?: () => void;
  /** Show the month stepper (Records, Analysis, Budgets). */
  monthNav?: {
    year: number;
    month: number;
    maxYear: number;
    maxMonth: number;
  };
  /** Back link, for a detail screen. Replaces the greeting. */
  back?: { href: string; label: string };
  /** The one-line summary shown once the hero has scrolled away. */
  compact?: React.ReactNode;
  compactShown?: boolean;
  className?: string;
};

/**
 * The top of every screen, the same on all of them.
 *
 * Left to right: the mark (or a back link on a detail screen), the title
 * with its subtitle beneath, then this screen's own action if it has one,
 * search, and the profile. Every screen used to assemble its own: Records
 * had a greeting, search and an avatar; Analysis had neither; Budgets had
 * no subtitle; detail screens had a back link and nothing else. The parts
 * now come from here, so a screen supplies its words and nothing more.
 *
 * Phase 14 dropped the frosted glass: the header is the page background
 * with a hairline underneath once something has scrolled under it.
 */
export function PageHeader({
  title,
  description,
  actions,
  onSearch,
  monthNav,
  back,
  compact,
  compactShown = false,
  className,
}: PageHeaderProps) {
  const inner = (
    <div className="pt-safe">
      <div className="flex min-h-16 items-center justify-between gap-2 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* A detail screen needs its way back more than it needs the
              mark, and both do not fit beside a title at 360px. */}
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="text-text hoverable:bg-surface-muted rounded-control -ml-2 flex size-11 shrink-0 items-center justify-center"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <HeaderLogo />
          )}

          <div className="min-w-0">
            <h1 className="font-display truncate text-2xl leading-tight tracking-[-0.03em] sm:text-[28px]">
              {title}
            </h1>
            <p className="text-text-secondary truncate text-xs sm:text-sm">
              {description}
            </p>
          </div>

          <OfflinePill className="ml-1" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <HeaderSearch onSearch={onSearch} />
          <HeaderProfile />
        </div>
      </div>

      {monthNav ? <MonthSwitcher {...monthNav} /> : null}

      {compact ? (
        <div
          // Height and opacity rather than mounting: a strip that appears
          // from nothing nudges the whole page down by its own height the
          // moment it arrives, which is a layout shift caused by scrolling.
          className={cn(
            "overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none",
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
        "bg-background sticky top-0 z-30 -mx-4 mb-3 px-4 lg:-mx-6 lg:px-6",
        // The line only when something is under it. A header that is always
        // underlined looks like a table that lost its rows.
        compactShown ? "border-b" : "border-b border-transparent",
        className,
      )}
    >
      {/* A month-scoped header is swipeable; the rest have nothing to step. */}
      {monthNav ? <MonthSwipe {...monthNav}>{inner}</MonthSwipe> : inner}
    </header>
  );
}
