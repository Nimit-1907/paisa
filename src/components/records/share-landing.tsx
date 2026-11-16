"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { useCurrency, useTimeZone } from "@/components/profile-provider";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { PageShell } from "@/components/layout/page-shell";
import { sharedDraft } from "@/lib/share";

/**
 * Opens Add Record with what was shared, over Records.
 *
 * The URL becomes /records at once, so Back does not land on the share
 * again and a reload does not re-open it. Nothing is saved here: the
 * person checks the amount, picks the category and taps Save.
 */
export function ShareLanding({ text }: { text: string }) {
  const sheet = useRecordSheet();
  const currency = useCurrency();
  const timeZone = useTimeZone();
  const router = useRouter();
  const opened = React.useRef(false);

  React.useEffect(() => {
    if (opened.current || !sheet.ready) return;
    opened.current = true;
    router.replace("/records");
    sheet.openLogAgain(
      sharedDraft(text, {
        decimals: currency.decimals,
        timeZone,
        now: new Date(),
      }),
    );
  }, [sheet, text, currency.decimals, timeZone, router]);

  return (
    <PageShell>
      <p className="text-text-secondary py-10 text-center text-sm">
        Opening the shared payment…
      </p>
    </PageShell>
  );
}
