import { cn } from "@/lib/utils";

/**
 * The Phase 14 surfaces, in one file.
 *
 * The whole style rests on one rule: everything is flat with a hairline,
 * and exactly one thing per screen is bold. Putting the flat card and the
 * bold card next to each other here is the cheapest way to keep that rule
 * visible to whoever writes the next screen.
 */

/**
 * A flat card. The default for everything that is not the hero.
 *
 * No shadow, by design. In this language depth is not a gradient of
 * elevation — it is binary, and a card that is "slightly raised" muddies
 * the one card that is raised on purpose.
 */
export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "ul" | "li" | "article";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("bg-surface rounded-card border", className)} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A list card: hairline border outside, hairline dividers between rows.
 *
 * `overflow-hidden` so the first and last rows take the card's corners —
 * without it a row's background squares off the radius it sits inside.
 */
export function ListCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      className={cn(
        "bg-surface rounded-card divide-hairline divide-y overflow-hidden border",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/**
 * The one bold card per screen.
 *
 * 1.5px ink border and a `4px 4px 0` shadow with no blur. The lack of blur
 * is the point: the shadow is a second shape offset behind the first, which
 * is what makes a flat interface look deliberate rather than unfinished.
 *
 * The right margin is not decoration: the shadow is drawn outside the
 * element's box, and without room for it the hard edge gets clipped by the
 * page gutter at 360px.
 *
 * There is deliberately no bottom margin. Tailwind v4 emits `space-y-*` at
 * zero specificity, so a `mb-1` here silently beat the `space-y-4` of every
 * stack this card sits in and the gap under the one bold card on the screen
 * collapsed from 16px to 4px. The shadow instead sits inside the stack's own
 * gap, which leaves 12px clear under it.
 */
export function HeroCard({
  as: Tag = "section",
  flat = false,
  className,
  children,
  ...rest
}: {
  as?: "section" | "div" | "article";
  /** Drops the accent where another card on the screen has it instead. */
  flat?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "bg-surface rounded-hero p-4",
        flat ? "border" : "accent-lg mr-1",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
