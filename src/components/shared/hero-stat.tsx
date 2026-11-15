"use client";

import * as React from "react";

import { Grain } from "@/components/shared/grain";
import { cn } from "@/lib/utils";

/**
 * The one figure a screen is built around.
 *
 * Every summary screen had grown its own version of this — a label, a big
 * number, a line underneath — at slightly different sizes, which is how five
 * screens end up with five ideas of what "the important one" looks like. This
 * is that anatomy once.
 *
 * The figure is set in the anchor serif. Phase 12 kept the serif to the month
 * card alone; Phase 13 widens it to the hero figure on any screen, which is
 * the same rule stated better — the serif marks *the number you came for*,
 * and that is one per screen wherever you are. CLAUDE.md carries the updated
 * wording.
 */
export function HeroStat({
  label,
  value,
  caption,
  aside,
  legs,
  texture = true,
  children,
  className,
}: {
  /** Small line above the figure: "Left to spend", "Total balance". */
  label: string;
  /** The figure itself, already formatted — usually an `<Amount>`. */
  value: React.ReactNode;
  /** One short line under the figure, in plain words. */
  caption?: React.ReactNode;
  /** Top-right slot: a toggle, a chip, a link. */
  aside?: React.ReactNode;
  /** The two or three smaller figures that sit under the hero. */
  legs?: React.ReactNode;
  /**
   * The faint grain. On by default: a hero is the one large flat panel on
   * its screen, which is exactly what the texture stops reading as a hole.
   */
  texture?: boolean;
  /** Anything below: the bars on the month card, a progress track. */
  children?: React.ReactNode;
  className?: string;
}) {
  /*
   * A <section> is only a landmark if it has a name.
   *
   * Without one it is a generic box, and a screen reader user tabbing by
   * region never finds the figure the whole screen is built around. The
   * label above the number is already that name, so it is pointed at rather
   * than duplicated into an aria-label that could drift from it.
   */
  const labelId = React.useId();

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        "bento accent-wash relative overflow-hidden p-4",
        className,
      )}
    >
      {texture ? <Grain /> : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            id={labelId}
            className="text-ink-2 text-label font-semibold tracking-wide uppercase"
          >
            {label}
          </p>
          <p className="font-display mt-1 text-[2.5rem] leading-[1.05] tracking-tight">
            {value}
          </p>
          {caption ? (
            <p className="text-ink-2 mt-1.5 text-sm">{caption}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      {legs ? (
        <div className="relative mt-4 flex items-stretch gap-3">{legs}</div>
      ) : null}

      {children ? <div className="relative">{children}</div> : null}
    </section>
  );
}

/**
 * One of the smaller figures under a hero.
 *
 * Income and expense on Records, in and out on an account, spent and left on
 * a budget: the same two-up shape every time, so the eye learns it once.
 */
export function HeroLeg({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <p className="text-ink-2 text-label flex items-center gap-1 font-semibold tracking-wide uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold">{value}</p>
    </div>
  );
}
