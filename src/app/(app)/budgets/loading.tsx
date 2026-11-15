import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** The Budgets layout: ring and figures, then one row per budget. */
export default function BudgetsLoading() {
  return (
    <PageShell width="wide">
      <div className="space-y-6 pt-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>

      <div className="bg-card rounded-card border p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[72px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-lg" />
          <Skeleton className="h-11 flex-1 rounded-lg" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Skeleton className="ml-1 h-3 w-24" />
        <div className="bg-card divide-border divide-y rounded-card border">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full max-w-[12rem]" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PageShell>
  );
}
