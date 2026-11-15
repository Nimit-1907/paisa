import type { LucideIcon } from "lucide-react";

import {
  type EmptyArt,
  EmptyIllustration,
} from "@/components/shared/empty-illustration";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  /** A drawing instead of the icon, for the screens people meet first. */
  art?: EmptyArt;
  title: string;
  description: string;
  /** Primary call to action — every empty state should offer the next step. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  art,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border/70 bg-card rounded-card flex flex-col items-center border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {art ? (
        <EmptyIllustration art={art} />
      ) : (
        <span className="bg-muted text-ink-2 rounded-card mb-4 flex size-12 items-center justify-center">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-ink-2 mx-auto mt-1 max-w-[42ch] text-sm">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
