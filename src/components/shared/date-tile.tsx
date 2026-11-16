import { cn } from "@/lib/utils";

/** "Nov", three letters, in the user's locale rather than in English. */
function monthAbbrev(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "short",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * A date as a tile, where every other list puts a category.
 *
 * Recurring is the one screen where *when* is the identity. Twelve rules
 * wearing twelve category tiles is a list you have to read in full to find
 * the one due on the 3rd; a column of day numbers can be scanned. The name
 * beside it still says which rule it is.
 *
 * Periwinkle, like the dock's Add button and the day a new record lands on,
 * this app's one accent, used for the thing that is about to happen.
 */
export function DateTile({
  day,
  dimmed = false,
  size = "md",
  className,
}: {
  /** `yyyy-mm-dd`, or null for a rule with nothing left to run. */
  day: string | null;
  /** Paused and finished rules sit back a little. */
  dimmed?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "size-11" : "size-9";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "rounded-control text-text flex shrink-0 flex-col items-center justify-center leading-none",
        box,
        day ? "bg-tint-peri" : "bg-tint-neutral",
        dimmed && "opacity-50",
        className,
      )}
    >
      {day ? (
        <>
          <span className="text-[13px] font-bold">
            {Number(day.slice(8, 10))}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase">
            {monthAbbrev(day)}
          </span>
        </>
      ) : (
        // Set like the month abbreviation rather than like the day number:
        // the word has to live in a 36px square, where 13px would not fit.
        <span className="text-text-secondary text-[10px] font-semibold tracking-wide uppercase">
          None
        </span>
      )}
    </span>
  );
}
