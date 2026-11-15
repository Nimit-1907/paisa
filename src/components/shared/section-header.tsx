import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The line that starts a group.
 *
 * "Due soon", "Not budgeted", "Today" — a label on the left, an optional
 * count beside it, and at most one action on the right. Sentence case, like
 * everything else: the labels were a mix of Title Case and sentence case
 * across six screens, and the inconsistency is more noticeable than either
 * choice.
 */
export function SectionHeader({
  title,
  count,
  description,
  action,
  trailing,
  className,
}: {
  title: string;
  /** Shown beside the title when there is more than one thing. */
  count?: number;
  description?: string;
  /** A "See all" style link. */
  action?: { href: string; label: string };
  /** Anything else on the right: a day total, a toggle. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <div className="min-w-0">
        {/* 14px/600, sentence case. Phase 14 removes labels
            everywhere — a row of small-caps headings reads as filing. */}
        <h2 className="text-text flex items-baseline gap-1.5 text-sm font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-text-secondary text-xs font-medium">
              {count}
            </span>
          ) : null}
        </h2>
        {description ? (
          <p className="text-text-secondary mt-0.5 text-xs">{description}</p>
        ) : null}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="text-text-secondary hoverable:text-text rounded-control -mr-1 shrink-0 px-1 py-1 text-xs font-semibold"
        >
          {action.label}
        </Link>
      ) : (
        trailing
      )}
    </div>
  );
}
