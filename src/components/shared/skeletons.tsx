import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading shapes that match what arrives.
 *
 * A skeleton earns its place only if the real thing lands in the same place:
 * a grey block where the hero figure will be, rows the height of real rows.
 * One that is roughly the right idea is worse than a spinner, because the
 * layout jumps when the content replaces it — which is a CLS score as well
 * as a flinch.
 *
 * These are the shapes; each screen's `loading.tsx` composes them in its own
 * order.
 */
export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="bg-card rounded-card divide-border divide-y border">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex min-h-16 items-center gap-3 px-3 py-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Varied widths: five identical bars read as a table, not a list. */}
            <Skeleton
              className="h-3.5"
              style={{ width: `${48 + ((index * 17) % 34)}%` }}
            />
            <Skeleton
              className="h-2.5"
              style={{ width: `${28 + ((index * 23) % 26)}%` }}
            />
          </div>
          <Skeleton className="h-3.5 w-16 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** The hero card's shape: label, big figure, two legs. */
export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bento p-4", className)}>
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-2.5 h-10 w-48" />
      <Skeleton className="mt-2 h-3 w-36" />
      <div className="mt-4 flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

/** A chart card's shape, for the bento grid on Analysis. */
export function CardSkeleton({
  className,
  lines = 0,
}: {
  className?: string;
  /** Rows of text under the block, for a legend or a table. */
  lines?: number;
}) {
  return (
    <div className={cn("bento space-y-3 p-4", className)}>
      <Skeleton className="h-2.5 w-28" />
      <Skeleton className="h-32 w-full" />
      {lines > 0 ? (
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton
              key={index}
              className="h-3"
              style={{ width: `${60 + ((index * 13) % 30)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
