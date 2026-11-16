import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Primary call to action, every empty state should offer the next step. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-hairline bg-surface rounded-card flex flex-col items-center border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {/* One mark for every empty state. Some screens had a drawing and
          some an icon, so two empty screens side by side looked like they
          came from different apps. */}
      <span className="bg-surface-muted text-text-secondary rounded-card mb-4 flex size-12 items-center justify-center">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-text-secondary mx-auto mt-1 max-w-[42ch] text-sm">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
