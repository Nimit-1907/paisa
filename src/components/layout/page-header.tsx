import Link from "next/link";

import { ChevronLeft, User } from "lucide-react";

import { MonthSwipe } from "@/components/layout/month-swipe";
import { MonthSwitcher } from "@/components/layout/month-switcher";
import { OfflinePill } from "@/components/shared/offline-pill";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** The line above the title. Records only — "Good evening, Aarav". */
  greeting?: string;
  /** Short line under the title, for sub-pages with no month switcher. */
  description?: string;
  /** Ghost icon buttons and the avatar, on the right of the title row. */
  actions?: React.ReactNode;
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
 * The top of every screen.
 *
 * Phase 14 drops the frosted glass: the header is the page background with
 * a hairline underneath, and the hairline only appears once something has
 * scrolled under it. Glass was doing two jobs at once — separating the
 * header and suggesting depth — and in a flat language the second one is
 * noise. A line is enough, and it costs no `backdrop-filter`.
 *
 * The title is Bricolage 800 at 28px, which with the hero number is the
 * only place that face appears.
 */
export function PageHeader({
  title,
  greeting,
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
      <div className="flex min-h-14 items-start justify-between gap-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="text-text hoverable:bg-surface-muted rounded-control -ml-2 flex size-11 shrink-0 items-center justify-center"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : null}

          <div className="min-w-0">
            {greeting && !back ? (
              <p className="text-text-secondary truncate text-xs">{greeting}</p>
            ) : null}
            <h1 className="font-display truncate text-[28px] leading-tight tracking-[-0.03em]">
              {title}
            </h1>
          </div>

          <OfflinePill className="ml-1" />
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-1">{actions}</div>
      </div>

      {monthNav ? <MonthSwitcher {...monthNav} /> : null}

      {description && !monthNav ? (
        <p className="text-text-secondary -mt-1 pb-3 text-sm">{description}</p>
      ) : null}

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

/**
 * The avatar that opens More.
 *
 * Lilac tint with a 1.5px ink border — one of the few places outside a hero
 * that carries an ink edge, because it is the only control in the header
 * that is a destination rather than an action.
 */
export function HeaderAvatar({ name }: { name: string }) {
  // Two letters at most. Somebody who has not set a name gets the icon
  // rather than a word — "You" is three characters in a 36px circle at
  // 12px, which clips, and initials are not what it would be saying.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Link
      href="/more"
      // The initials are in the name as well as on the circle. They are
      // marked decorative, but WCAG 2.5.3 is about what is *drawn*: a label
      // that does not contain the visible text is one somebody using voice
      // control cannot say out loud.
      aria-label={
        initials
          ? `${initials}. Your profile and settings`
          : "Your profile and settings"
      }
      className="bg-tint-lilac text-text border-ink pressable flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold"
    >
      {initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <User className="size-4" aria-hidden="true" />
      )}
    </Link>
  );
}
