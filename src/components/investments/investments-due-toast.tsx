"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

/**
 * What the day's catch-up did in the investments ledger, said once.
 *
 * Instalments a SIP or RD posted on its own get a line, so money appearing
 * in the ledger is never a mystery. A deposit that has matured gets the
 * prompt to record its payout, because nothing is recorded until the user
 * says what the bank actually paid.
 */
export function InvestmentsDueToast({
  instalments,
  matured,
}: {
  instalments: number;
  matured: { id: string; name: string }[];
}) {
  const router = useRouter();
  const handled = React.useRef(false);

  React.useEffect(() => {
    if (handled.current) return;
    if (instalments <= 0 && matured.length === 0) return;
    handled.current = true;

    if (instalments > 0) {
      toast.success(
        instalments === 1
          ? "1 investment instalment posted"
          : `${instalments} investment instalments posted`,
        {
          id: "investments-posted",
          description: "Your SIPs and RDs, dated when they were due.",
          action: {
            label: "View",
            onClick: () => router.push("/investments"),
          },
        },
      );
    }

    const first = matured[0];
    if (first) {
      toast(
        matured.length === 1
          ? `${first.name} has matured`
          : `${matured.length} deposits have matured`,
        {
          id: "investments-matured",
          description: "Record what was paid out to close it.",
          duration: 10000,
          action: {
            label: matured.length === 1 ? "Record payout" : "View",
            onClick: () =>
              router.push(
                matured.length === 1
                  ? `/investments/${first.id}?payout=1`
                  : "/investments",
              ),
          },
        },
      );
    }
  }, [instalments, matured, router]);

  return null;
}
