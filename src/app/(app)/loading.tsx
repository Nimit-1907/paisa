import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeleton for the (app) tabs while a page's data loads. */
export default function AppLoading() {
  return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-9 w-40" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </div>
  );
}
