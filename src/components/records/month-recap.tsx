"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

import { dismissRecap } from "@/actions/profile";
import { useFormatMoney } from "@/components/profile-provider";
import type { MonthRecap } from "@/lib/queries/recap";

/**
 * Last month, once, on the first visit of the new one.
 *
 * A month ending is the natural moment to look back, and it is the only
 * moment this app volunteers a summary nobody asked for — so it is one card,
 * four facts, and a way out. Dismissing is remembered on the server, because
 * a card that comes back on the laptop was never really dismissed.
 *
 * Optimistically hidden: the card goes the moment it is tapped, and the
 * server catches up. The worst case is that it reappears on the next load,
 * which is exactly what would have happened anyway.
 */
export function MonthRecap({
  recap,
  monthLabel,
}: {
  recap: MonthRecap;
  /** "October", for the heading. */
  monthLabel: string;
}) {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  const [hidden, setHidden] = React.useState(false);

  if (hidden) return null;

  const change = recap.changePercent;
  const spent = formatMoney(BigInt(recap.spent), {
    signDisplay: "never",
    whole: true,
  });

  const facts = [
    recap.topCategory ? `Most of it on ${recap.topCategory.name}` : null,
    change === null
      ? null
      : Math.abs(change) < 5
        ? "About the same as the month before"
        : `${Math.abs(change)}% ${change > 0 ? "more" : "less"} than the month before`,
    recap.budgetsTotal > 0
      ? `You stayed under budget in ${recap.budgetsKept} of ${recap.budgetsTotal} ${
          recap.budgetsTotal === 1 ? "category" : "categories"
        }`
      : null,
  ].filter(Boolean) as string[];

  async function dismiss() {
    setHidden(true);

    try {
      const result = await dismissRecap(recap.month);

      if (!result.ok) {
        // Put it back rather than leave the screen claiming something the
        // server does not agree with; it would return on the next load
        // anyway, which is more confusing than it returning now.
        setHidden(false);
        toast.error(result.error);
        return;
      }

      router.refresh();
    } catch (thrown) {
      console.error("[records]", thrown);
      setHidden(false);
      toast.error("Could not dismiss that. Check your connection.");
    }
  }

  return (
    /*
     * The hero of the day it appears.
     *
     * Phase 14 allows exactly one accent card per screen, and on the first
     * open of a new month this is the thing worth reading — so it takes the
     * accent and the month card below it goes flat for that one visit. Two
     * bold cards would be two focal points and therefore none.
     */
    <section
      aria-label={`${monthLabel} in summary`}
      className="bg-surface rounded-hero accent-lg relative mr-1 p-4"
    >
      <button
        type="button"
        onClick={() => void dismiss()}
        aria-label={`Dismiss the ${monthLabel} summary`}
        className="text-text-secondary hoverable:bg-surface-muted hoverable:text-text rounded-control absolute top-2 right-2 flex size-11 items-center justify-center"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <h2 className="text-text-secondary text-[13px]">
        {monthLabel} in summary
      </h2>

      <p className="font-display amount-hero mt-0.5 truncate pr-10 text-[42px] leading-[1.05] tracking-[-0.03em]">
        {spent}
      </p>

      <ul className="text-text-secondary mt-2 space-y-0.5 text-sm">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>

      <Link
        href={`/analysis?p=month&d=${recap.month}`}
        className="text-text mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline underline-offset-4"
      >
        See the full month
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
