import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { FEATURES } from "@/app/(marketing)/_content";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Features",
  description: `Everything ${SITE.name} does: four-tap records, per-category budgets, charts that agree with the list, transfers between your own accounts, repeating bills, and an export you can take with you.`,
  alternates: { canonical: "/features" },
  openGraph: {
    type: "website",
    url: "/features",
    title: `Features · ${SITE.name}`,
    description: `Everything ${SITE.name} does, in plain terms.`,
  },
};

export default function FeaturesPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Features
      </h1>
      <p className="text-text-secondary mt-3 max-w-[56ch]">
        Six things, each of which exists because logging money is otherwise
        tedious enough that people stop.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <li
              key={feature.title}
              className="bg-surface rounded-card border p-4"
            >
              {/* The app's own tinted tile, so the page that describes
                  the product looks like the product. */}
              <span
                className={cn(
                  "rounded-control text-text mb-3 flex size-10 items-center justify-center",
                  feature.tint,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold">{feature.title}</h2>
              <p className="text-text-secondary mt-1 text-sm">{feature.body}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-8">
        <Link
          href="/signup"
          className="bg-ink text-on-ink hoverable:bg-ink/90 pressable inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          Start tracking — it&rsquo;s free
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}
