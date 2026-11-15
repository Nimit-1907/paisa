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
        <h2 className="text-ink flex items-baseline gap-1.5 text-sm font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-ink-3 text-xs font-medium">{count}</span>
          ) : null}
        </h2>
        {description ? (
          <p className="text-ink-2 mt-0.5 text-xs">{description}</p>
        ) : null}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="text-primary focus-visible:ring-ring -mr-1 shrink-0 rounded-control px-1 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {action.label}
        </Link>
      ) : (
        trailing
      )}
    </div>
  );
}
