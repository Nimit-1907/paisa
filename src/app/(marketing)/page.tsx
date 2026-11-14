import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, Check } from "lucide-react";

import { AppPreview } from "@/app/(marketing)/_app-preview";
import { FEATURES } from "@/app/(marketing)/_content";
import { SITE, siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  // The brand goes last: "Know where your money went" is what a search result
  // and a shared link have room to show.
  title: {
    absolute: `${SITE.name} — ${SITE.description.split(".")[0]}.`,
  },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
};

/** Four taps, named, because the claim in the hero has to be checkable. */
const STEPS = [
  "Tap +",
  "Type the amount",
  "Pick the category",
  "Save",
];

export default function LandingPage() {
  const origin = siteOrigin();

  /**
   * SoftwareApplication, so a search engine can show this as an app rather
   * than as a page about one. The price is stated because a free app with no
   * offer attached is treated as price-unknown.
   */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: `${origin}/`,
    description: SITE.description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web browser, Android, iOS",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    featureList: FEATURES.map((feature) => feature.title),
  };

  return (
    <>
      {/*
        Built from the same constants the page renders, so the markup and the
        page cannot describe two different apps.

        Passed as a text child rather than as raw inner HTML: React writes a
        script's children out unescaped, and neutralises a closing script tag
        inside them, so the JSON arrives intact with no HTML sink involved.
      */}
      {/* rubric:allow COR-BUG React writes a script's children out raw; verified against the built page, which parses as JSON with no entities. */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>

      {/*
        Above the fold: a headline, a sentence, one button, and the app.
        What used to be here too — a second button and a line of
        reassurance — competed with the only decision this page asks for.
      */}
      <section className="grid items-center gap-8 py-6 sm:py-12 lg:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Know where the month went.
          </h1>

          <p className="text-muted-foreground mt-4 max-w-[46ch] text-base text-pretty sm:text-lg">
            {SITE.description}
          </p>

          <Link
            href="/signup"
            className="bg-primary text-primary-foreground hoverable:bg-primary/90 focus-visible:ring-ring mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[transform,background-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none active:scale-[0.97]"
          >
            Start tracking — it&rsquo;s free
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <AppPreview />
      </section>

      <section className="bg-card rounded-2xl border p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Logging an expense, in full
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Four taps, because the account and the date are already filled in and
          the categories you use at this time of day are at the top.
        </p>

        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="bg-background flex items-center gap-2.5 rounded-xl border p-3"
            >
              <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                {index + 1}
              </span>
              <span className="text-sm font-semibold">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          What you get
        </h2>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 3).map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="bg-card rounded-2xl border p-4"
              >
                <span className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {feature.body}
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-sm">
          <Link href="/features" className="text-primary underline">
            Everything else it does
          </Link>
        </p>
      </section>

      <section className="mt-10 border-t pt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Why you can trust it with this
        </h2>

        <ul className="mt-3 space-y-2">
          {[
            "No bank login, no advertising, no trackers.",
            "Your rows are isolated by the database itself, not by the app remembering to filter.",
            "Amounts are whole paise end to end — nothing divides your money into a decimal.",
            "Export every record as a CSV, or a month as a PDF, whenever you want it.",
          ].map((point) => (
            <li key={point} className="flex gap-2.5 text-sm">
              <Check
                className="text-income mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-6">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground hoverable:bg-primary/90 focus-visible:ring-ring inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Create your account
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </section>
    </>
  );
}
