import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ExportScreen } from "@/components/settings/export-screen";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { periodContaining } from "@/lib/period";
import { getProfile } from "@/lib/profile";
import { getRecordsSpan } from "@/lib/queries/transactions";
import { localToday } from "@/lib/recurring-check";
import { dateFormat } from "@/lib/date-format";

export const metadata: Metadata = { title: "Export" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** The last two years of months, newest first. */
function recentMonths(today: string) {
  const [year, month] = today.split("-").map(Number);
  const options: { value: string; label: string }[] = [];

  for (let step = 0; step < 24; step += 1) {
    const total = year * 12 + (month - 1) - step;
    const value = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;

    options.push({
      value,
      label: MONTH_LABEL.format(new Date(`${value}-01T00:00:00Z`)),
    });
  }

  return options;
}

/**
 * "Sept 2024 – Nov 2026", or one month when that is all there is.
 *
 * In the user's timezone, not the server's. `occurred_at` is an instant:
 * a record at 20:00 UTC on 30 November is the 1st of December in Kolkata,
 * and a summary that disagrees with the month switcher about which month a
 * record is in is worse than no summary.
 */
function spanLabel(
  first: string | null,
  last: string | null,
  timeZone: string,
): string | null {
  if (!first || !last) return null;

  const format = dateFormat({
    timeZone,
    month: "short",
    year: "numeric",
  });

  const from = format.format(new Date(first));
  const to = format.format(new Date(last));

  return from === to ? from : `${from} – ${to}`;
}

export default async function ExportPage() {
  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const today = localToday(timeZone);
  const thisMonth = periodContaining("month", today);

  // One count and two head reads. `null` rather than zeros when it fails:
  // "0 records · Nothing logged yet" shown to somebody with three years of
  // them is a lie, where a missing line is only a missing line. Export's
  // job is the download button under it either way.
  const span = await getRecordsSpan().catch((thrown: unknown) => {
    console.error("[export]", thrown);
    return null;
  });

  return (
    <PageShell>
      <PageHeader title="Export" description="Download your records" />

      <ExportScreen
        defaultFrom={thisMonth.from}
        defaultTo={today}
        defaultMonth={today.slice(0, 7)}
        monthOptions={recentMonths(today)}
        today={today}
        summary={
          span
            ? {
                count: span.count,
                span: spanLabel(span.first, span.last, timeZone),
              }
            : null
        }
      />
    </PageShell>
  );
}
