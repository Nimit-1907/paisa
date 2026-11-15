import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** The Analysis layout: period, kind, the sentence, then the charts. */
export default function AnalysisLoading() {
  return (
    <PageShell width="wide">
      <div className="space-y-4 pt-4" aria-hidden="true">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-11 w-full rounded-control" />
      <Skeleton className="h-11 w-full rounded-control" />
      <Skeleton className="h-14 w-full rounded-card" />

      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-20 rounded-card" />
        ))}
      </div>

      {[0, 1].map((chart) => (
        <div key={chart} className="bg-card space-y-3 rounded-card border p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[200px] w-full rounded-control" />
        </div>
      ))}
    </div>
    </PageShell>
  );
}
