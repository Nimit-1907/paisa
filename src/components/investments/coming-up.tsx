"use client";

import Link from "next/link";

import { Amount } from "@/components/shared/amount";
import { DateTile } from "@/components/shared/date-tile";
import { Pill } from "@/components/shared/pill";
import { ListCard } from "@/components/shared/surface";
import { Button } from "@/components/ui/button";
import { type ComingUpItem, KIND_META } from "@/lib/investments";

/** Instalments and maturities, soonest first, each opening its investment. */
export function ComingUpList({ items }: { items: ComingUpItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
        Nothing due in the next 30 days.
      </p>
    );
  }

  return (
    <ListCard>
      {items.map((item) => (
        <li
          key={`${item.investment.id}-${item.kind}`}
          className="flex items-center gap-2 pr-3"
        >
          {/* The whole row is the link, date tile included: the text alone
              was a 36px target. */}
          <Link
            href={`/investments/${item.investment.id}`}
            className="hoverable:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-3 transition-colors"
          >
          <DateTile day={item.date} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {item.investment.name}
            </span>
            <span className="text-text-secondary flex items-center gap-1.5 truncate text-xs">
              {item.kind === "maturity" ? (
                <>
                  <Pill tone="warning">
                    {item.inDays < 0
                      ? "Matured"
                      : item.inDays === 0
                        ? "Matures today"
                        : `Matures in ${item.inDays} ${item.inDays === 1 ? "day" : "days"}`}
                  </Pill>
                  {item.amount !== null ? (
                    <Amount value={BigInt(item.amount)} />
                  ) : null}
                </>
              ) : (
                <>
                  <span>
                    {KIND_META[item.investment.kind].label} instalment
                  </span>
                  <span aria-hidden="true">·</span>
                  {item.amount !== null ? (
                    <Amount value={BigInt(item.amount)} />
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>posts itself</span>
                </>
              )}
            </span>
          </span>
          </Link>
          {item.kind === "maturity" && item.inDays <= 0 ? (
            <Button asChild size="touch" variant="outline">
              <Link href={`/investments/${item.investment.id}?payout=1`}>
                Payout
              </Link>
            </Button>
          ) : null}
        </li>
      ))}
    </ListCard>
  );
}
