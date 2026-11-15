import type { Metadata } from "next";

import Link from "next/link";

import { Database, Lock, Smartphone } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { InstallButton } from "@/components/pwa/install-button";
import { Card, ListCard } from "@/components/shared/surface";

export const metadata: Metadata = { title: "About" };

const POINTS = [
  {
    icon: Lock,
    title: "Your records are yours",
    body: "Every table is scoped to your account by row level security, so a query can only ever return your own rows. That is a rule the database enforces, not one the app follows.",
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
      <PageHeader title="About" description="Paisa expense tracker" />

      <div className="space-y-4">
        <Card as="section" className="p-4">
          <p className="text-sm">
            Paisa keeps track of what you spend, earn and move between your own
            accounts: records by the day, limits by the month, and charts that
            add up to the same numbers the list shows.
          </p>

          <p className="text-text-secondary mt-3 text-xs">
            Nothing here is locked in. The{" "}
            <Link href="/export" className="text-text underline">
              Export
            </Link>{" "}
            screen will hand you every record as a CSV, or one month as a PDF,
            whenever you want it.
          </p>
        </Card>

        <ListCard>
          {POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.title} className="flex gap-3 p-3">
                <span className="bg-surface-muted text-text rounded-control flex size-9 shrink-0 items-center justify-center">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {point.title}
                  </span>
                  <span className="text-text-secondary block text-xs">
                    {point.body}
                  </span>
                </span>
              </li>
            );
          })}
        </ListCard>

        <InstallButton />
      </div>
    </PageShell>
  );
}
