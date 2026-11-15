"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { payOccurrenceNow } from "@/actions/recurring";
import { useFormatMoney } from "@/components/profile-provider";
import { RuleAvatar } from "@/components/recurring/rule-avatar";
import { Button } from "@/components/ui/button";
import { ruleTitle, type UpcomingOccurrence } from "@/lib/recurring-rule";
import { relativeDay } from "@/lib/relative-day";
import { cn } from "@/lib/utils";

/** How many of the week's scheduled items the strip shows before linking. */
const MAX_SHOWN = 3;

/**
 * What is due in the next seven days.
 *
 * These are computed, not rows: nothing is written until the day arrives (or
 * until "Pay now"), so the list is the same whether the app was opened
 * yesterday or last month. It collapses because it is a reminder, not the
 * month's record — and the chevron keeps the day's spending one glance away.
 */
export function UpcomingStrip({
  items,
  today,
}: {
  items: UpcomingOccurrence[];
  today: string;
}) {
  const router = useRouter();
  const formatMoney = useFormatMoney();

  const [open, setOpen] = React.useState(false);
  const [paying, setPaying] = React.useState<string | null>(null);

  if (items.length === 0) return null;

  /*
   * Three, then a link.
   *
   * This is a reminder sitting above the month, not a second list. Seven
   * days of a busy month can be a dozen rules, and a dozen rows pushed the
   * records themselves off the screen - which is the one thing this strip
   * must not do. Recurring is where the whole set lives.
   */
  const shown = items.slice(0, MAX_SHOWN);
  const rest = items.length - shown.length;

  // Expenses only, the same rule the day totals follow: a transfer moves
  // money between the user's own accounts, so counting it here would
  // overstate what is about to be spent.
  const total = items.reduce(
    (sum, item) =>
      item.rule.type === "expense" ? sum + BigInt(item.rule.amount) : sum,
    0n,
  );

  async function pay(item: UpcomingOccurrence) {
    setPaying(item.key);

    try {
      const result = await payOccurrenceNow({
        id: item.ruleId,
        on: item.on,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.transactionId
          ? "Added to your records"
          : "That one was already added",
      );
      router.refresh();
    } catch (thrown) {
      console.error("[recurring]", thrown);
      toast.error("Could not add that record. Check your connection.");
    } finally {
      setPaying(null);
    }
  }

  return (
    <section
      aria-label="Upcoming"
      className="bg-card overflow-hidden rounded-2xl border"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="hoverable:bg-muted/50 focus-visible:ring-ring flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        <CalendarClock
          className="text-ink-2 size-4 shrink-0"
          aria-hidden="true"
        />
        <span className="flex-1 text-sm font-semibold">
          Upcoming
          <span className="text-ink-2 font-normal">
            {" · "}
            {items.length} in 7 days
          </span>
        </span>
        {total > 0n ? (
          <span className="amount text-ink-2 shrink-0 text-xs font-semibold">
            {formatMoney(total, { signDisplay: "never" })}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "text-ink-2 size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul className="divide-border border-t divide-y">
          {shown.map((item) => {
            const { rule } = item;

            return (
              <li key={item.key} className="flex items-center gap-2 px-3 py-2">
                <RuleAvatar rule={rule} />

                <span className="min-w-0 flex-1">
                  <Link
                    href={`/recurring/${rule.id}`}
                    className="focus-visible:ring-ring block truncate text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {ruleTitle(rule)}
                  </Link>
                  <span className="text-ink-2 block truncate text-xs">
                    {relativeDay(item.on, today)} ·{" "}
                    {formatMoney(BigInt(rule.amount), {
                      signDisplay: "never",
                    })}
                  </span>
                </span>

                <Button
                  variant="outline"
                  size="touch"
                  className="shrink-0 px-3"
                  disabled={paying !== null}
                  onClick={() => void pay(item)}
                >
                  {paying === item.key ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Pay now
                </Button>
              </li>
            );
          })}

          {rest > 0 ? (
            <li>
              <Link
                href="/recurring"
                className="text-primary hoverable:bg-muted/50 focus-visible:ring-ring flex min-h-11 items-center justify-center gap-1 text-xs font-semibold focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                See all {items.length} scheduled
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
