import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape of a list screen, while its data arrives.
 *
 * A skeleton is a promise about what is coming, so it has to be the same
 * shape as what arrives: this is a sticky header, one summary card, a row of
 * controls and a grouped list — Records, Accounts, Recurring and Categories
 * all land on exactly this. The screens that look different (Analysis and
 * Budgets) have their own.
 */
export default function AppLoading() {
  return (
    <PageShell>
      <div className="space-y-4 pt-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>

      {/* The summary card: label, the month's number, the two figures. */}
      <div className="bg-card space-y-2 rounded-card border px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-48" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      {[0, 1].map((group) => (
        <div key={group} className="space-y-1.5">
          <Skeleton className="ml-1 h-3 w-28" />
          <div className="bg-card divide-border divide-y rounded-card border">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex min-h-16 items-center gap-3 px-3 py-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    </PageShell>
  );
}
