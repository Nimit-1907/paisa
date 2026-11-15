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
 * Three ways to be operable, in order of preference:
 *
 *  - `control`: a real native control — a `<select>`, an `<input
 *    type="datetime-local">` — laid over the card at zero opacity. The card
 *    draws the value the way this app draws values (a tint tile, "Today,
 *    1:30 pm"), which no native control can be made to do, while the thing
 *    a tap, a keyboard and a screen reader actually meet is the native one.
 *    The card then takes the focus ring on its behalf.
 *  - `onClick`: a button, for a choice that opens something of our own.
 *  - neither: a read-only fact.
 */
export function FieldCard({
  label,
  icon,
  value,
  onClick,
  control,
  invalid = false,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  /** Omit for a read-only fact. */
  onClick?: () => void;
  /** A native control to lay over the card; see above. */
  control?: React.ReactNode;
  /** The save was refused because of this field. */
  invalid?: boolean;
  className?: string;
}) {
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

  if (control) {
    return (
      // The ring is drawn here because the control inside is invisible, and
      // an outline on something with no pixels is an outline nobody sees.
      <div
        className={cn(
          base,
          "relative has-[:focus-visible]:outline-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
        )}
      >
        {/* The native control below carries the same words to the
            accessibility tree, and says what kind of control it is. */}
        <span aria-hidden="true" className="block">
          {inside}
        </span>
        <span className="absolute inset-0 opacity-0 [&>*]:size-full">
          {control}
        </span>
      </div>
    );
  }

  if (!onClick) return <div className={base}>{inside}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, "pressable hoverable:bg-surface-muted")}
    >
      {inside}
    </button>
  );
}
