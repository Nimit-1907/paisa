import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { TINT_BG, type TintKey, isTint } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function tintBackground(tint: string | null | undefined): string {
  return TINT_BG[isTint(tint ?? "") ? (tint as TintKey) : "neutral"];
}

const SIZES = {
  sm: { box: "size-7 rounded-[9px]", icon: "size-3.5" },
  md: { box: "size-9 rounded-control", icon: "size-[18px]" },
  lg: { box: "size-11 rounded-control", icon: "size-5" },
} as const;

/**
 * A tinted icon tile.
 *
 * The thing that tells you which category or account a row belongs to,
 * replacing the Phase 12 coloured circle. Two differences that matter:
 *
 *  - It is a **rounded square**, not a circle. A grid of circles reads as a
 *    list of people; a grid of squares reads as a set of things.
 *  - The icon on it is **always plain ink**, never white and never tinted.
 *    That is what lets the tints stay this pale: the icon carries the
 *    contrast (11:1 or better on every tint, in both themes), so the tile
 *    only has to carry the identity.
 *
 * Decorative throughout. The row beside it says the category's name, and a
 * screen reader hearing "rose tile" learns nothing.
 */
export function Tile({
  tint,
  icon,
  size = "md",
  className,
  children,
}: {
  tint: string | null | undefined;
  icon: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  /** A badge pinned to the tile, the tick on a selected category. */
  children?: React.ReactNode;
}) {
  const sizes = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-text relative flex shrink-0 items-center justify-center",
        sizes.box,
        tintBackground(tint),
        className,
      )}
    >
      <DynamicIcon name={icon} className={sizes.icon} />
      {children}
    </span>
  );
}
