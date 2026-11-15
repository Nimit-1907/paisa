import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ExportScreen } from "@/components/settings/export-screen";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { periodContaining } from "@/lib/period";
import { getProfile } from "@/lib/profile";
import { localToday } from "@/lib/recurring-check";

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

export default async function ExportPage() {
  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const today = localToday(timeZone);
  const thisMonth = periodContaining("month", today);

  return (
    <PageShell>
      <PageHeader
        title="Export"
        description="Take your records with you — nothing here is locked in."
      />

      <ExportScreen
        defaultFrom={thisMonth.from}
        defaultTo={today}
        defaultMonth={today.slice(0, 7)}
        monthOptions={recentMonths(today)}
      />
    </PageShell>
  );
}
