import { type TintKey } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/**
 * The small rounded labels: a trend, a status, a tag.
 *
 * Two kinds, and no third. A **tinted** pill borrows one of the eight soft
 * backgrounds and takes a money colour or plain ink on top; a **quiet** one
 * is the muted surface with secondary text. Anything that needs more
 * emphasis than those is not a pill, it is a button.
 */

const TONE: Record<string, string> = {
  income: "bg-tint-mint text-income",
  expense: "bg-tint-rose text-expense",
  transfer: "bg-tint-sky text-transfer",
  warning: "bg-tint-butter text-text",
  accent: "bg-tint-peri text-text",
  quiet: "bg-surface-muted text-text-secondary",
};

export type PillTone = keyof typeof TONE;

export function Pill({
  tone = "quiet",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold",
        TONE[tone] ?? TONE.quiet,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A pill carrying one of the eight tints directly, for a category tag. */
const TINT_PILL: Record<TintKey, string> = {
  rose: "bg-tint-rose",
  peach: "bg-tint-peach",
  sky: "bg-tint-sky",
  butter: "bg-tint-butter",
  mint: "bg-tint-mint",
  lilac: "bg-tint-lilac",
  peri: "bg-tint-peri",
  neutral: "bg-tint-neutral",
};

export function TintPill({
  tint,
  className,
  children,
}: {
  tint: TintKey;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-text inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold",
        TINT_PILL[tint],
        className,
      )}
    >
      {children}
    </span>
  );
}
