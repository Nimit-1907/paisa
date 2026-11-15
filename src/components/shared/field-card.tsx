"use client";

import { cn } from "@/lib/utils";

/**
 * A small labelled value you can tap to change: Account, When, From, To.
 *
 * Not an input. These hold a choice made somewhere else — a picker, a date
 * sheet — so they read as a current value rather than as an empty field
 * waiting for typing. The label sits above in secondary text at 11px and
 * the value below with its icon, which is the reference's arrangement and
 * the reason two of them fit side by side at 360px.
 */
export function FieldCard({
  label,
  icon,
  value,
  onClick,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  /** Omit for a read-only fact. */
  onClick?: () => void;
  className?: string;
}) {
  const inside = (
    <>
      <span className="text-text-secondary block text-[11px]">{label}</span>
      <span className="text-text mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold">
        {icon}
        <span className="truncate">{value}</span>
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div
        className={cn(
          "bg-surface rounded-control min-w-0 border px-3 py-2",
          className,
        )}
      >
        {inside}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-surface rounded-control pressable hoverable:bg-surface-muted min-w-0 border px-3 py-2 text-left",
        className,
      )}
    >
      {inside}
    </button>
  );
}
