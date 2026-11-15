import type { Metadata } from "next";

import Link from "next/link";

import { Database, Lock, Smartphone } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { InstallButton } from "@/components/pwa/install-button";

export const metadata: Metadata = { title: "About" };

const POINTS = [
  {
    icon: Lock,
    title: "Your records are yours",
    body: "Every table is scoped to your account by row level security, so a query can only ever return your own rows — not as a rule the app follows, but as one the database enforces.",
  },
  {
    icon: Database,
    title: "Money is never a float",
    body: "Amounts are whole paise end to end. Nothing in this app divides money into a decimal number, which is why a total never drifts by a rupee.",
  },
  {
    icon: Smartphone,
    title: "Built for a phone first",
    body: "Designed at 360px and widened from there. Add it to your home screen and it opens like an app, including the pages you have already visited when you are offline.",
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHeader title="About" description="Paisa — expense tracker" />

      <div className="space-y-4">
        <section className="bg-card rounded-card border p-4">
          <p className="text-sm">
            Paisa keeps track of what you spend, earn and move between your own
            accounts: records by the day, limits by the month, and charts that
            add up to the same numbers the list shows.
          </p>

          <p className="text-ink-2 mt-3 text-xs">
            Nothing here is locked in — the{" "}
            <Link href="/export" className="text-primary underline">
              Export
            </Link>{" "}
            screen will hand you every record as a CSV, or one month as a PDF,
            whenever you want it.
          </p>
        </section>

        <ul className="space-y-2">
          {POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li
                key={point.title}
                className="bg-card flex gap-3 rounded-card border p-3"
              >
                <span className="bg-muted text-ink-2 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {point.title}
                  </span>
                  <span className="text-ink-2 block text-xs">
                    {point.body}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <InstallButton />
      </div>
    </PageShell>
  );
}
