import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { FALLBACK_COLOR, iconInkFor } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** 28/36/40px circles, carrying a 16/20/20px icon. Nothing in between. */
const SIZES = {
  sm: { circle: "size-7", icon: "size-4" },
  md: { circle: "size-9", icon: "size-5" },
  lg: { circle: "size-10", icon: "size-5" },
} as const;

/**
 * A category or account, as a coloured circle with its icon in it.
 *
 * One component for the six places that were each building this by hand,
 * which is what makes three things true at once: every circle is on the
 * scale (28, 36 or 40px, never 24 or 34), every icon is 16 or 20px, and the
 * icon's colour is chosen from the circle's luminance rather than assumed to
 * be white. The palette is all dark enough for white, but a colour stored
 * before the palette existed is not, and a pale icon on a pale circle is
 * invisible rather than merely ugly.
 */
export function ColorDot({
  color,
  icon,
  size = "md",
  className,
  children,
}: {
  color: string | null;
  icon: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  /** A badge pinned to the circle — the tick on a selected category. */
  children?: React.ReactNode;
}) {
  const hex = color ?? FALLBACK_COLOR;
  const sizes = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        sizes.circle,
        iconInkFor(hex) === "light" ? "text-white" : "text-dot-ink",
        className,
      )}
      style={{ backgroundColor: hex }}
    >
      <DynamicIcon name={icon} className={sizes.icon} />
      {children}
    </span>
  );
}
