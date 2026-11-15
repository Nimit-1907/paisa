"use client";

import { cn } from "@/lib/utils";

/**
 * A small labelled value you can tap to change: Account, When, From, To.
 *
 * Not a text field. These hold a choice made somewhere else — a picker, a
 * date sheet — so they read as a current value rather than as an empty box
 * waiting for typing. The label sits above in secondary text at 11px and
 * the value below with its icon, which is the reference's arrangement and
 * the reason two of them fit side by side at 360px.
 *
 * Two ways to be operable:
 *
 *  - a button that opens something of our own: `onClick`, or `asTrigger`
 *    for a Select or a date panel that attaches its own handlers.
 *  - neither: a read-only fact.
 *
 * There used to be a third, an invisible native control laid over the
 * card. It is gone with the last native select and date input: the OS
 * pickers matched nothing else in the app, and the date ones could not be
 * typed into on a phone.
 */
export function FieldCard({
  label,
  icon,
  value,
  onClick,
  invalid = false,
  className,
  asTrigger = false,
  ref,
  ...rest
}: {
  /**
   * Render as a button even without an `onClick`, and forward whatever a
   * wrapper puts on it. This is what lets a `SelectTrigger asChild` wear
   * the card: Radix needs to attach its own handlers, `aria-expanded` and
   * a ref to the element the user actually presses.
   */
  asTrigger?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  /** Omit for a read-only fact. */
  onClick?: () => void;
  /** The save was refused because of this field. */
  invalid?: boolean;
  className?: string;
} & Omit<React.ComponentProps<"button">, "ref" | "value">) {
  const base = cn(
    "bg-surface rounded-control min-w-0 border px-3 py-2 text-left",
    invalid && "border-expense",
    className,
  );

  const inside = (
    <>
      <span className="text-text-secondary block text-[11px]">{label}</span>
      <span className="text-text mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold">
        {icon}
        <span className="truncate">{value}</span>
      </span>
    </>
  );

  if (!onClick && !asTrigger) return <div className={base}>{inside}</div>;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(base, "pressable hoverable:bg-surface-muted")}
      {...rest}
    >
      {inside}
    </button>
  );
}
