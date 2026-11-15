import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One sentence about what the numbers mean.
 *
 * Periwinkle, which is one of the five places that colour is allowed. It
 * earns it by being the only thing on the screen that is neither a figure
 * nor a control — the tint is what says "this is a remark, not data", so
 * nobody reads it as another total.
 *
 * Deliberately one line and no action. An insight that opens something is a
 * recommendation, and a recommendation about somebody's spending is a
 * different product.
 */
export function InsightStrip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  if (!children) return null;

  return (
    <p
      className={cn(
        "bg-tint-peri text-text flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-[13px] font-medium",
        className,
      )}
    >
      <Sparkles className="mt-[2px] size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
