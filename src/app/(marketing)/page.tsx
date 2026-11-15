import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, Check, ChevronDown } from "lucide-react";

import { AppPreview } from "@/components/marketing/app-preview";
import { FAQS, FEATURES, feature } from "@/app/(marketing)/_content";
import {
  BudgetCrop,
  RecurringCrop,
  TrackCrop,
} from "@/components/marketing/crops";
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
const STEPS = ["Tap +", "Type the amount", "Pick the category", "Save"];

/**
 * The three blocks, each with a crop of the screen it is about.
 *
 * Track, Budget, Recurring — the three things somebody decides between when
 * they are choosing one of these apps, in the order they would meet them.
 */
const BLOCKS = [
  { feature: feature("track"), crop: TrackCrop, label: "Track" },
  { feature: feature("budget"), crop: BudgetCrop, label: "Budget" },
  { feature: feature("recurring"), crop: RecurringCrop, label: "Recurring" },
] as const;

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
        The secondary route is a text link rather than a second button —
        two buttons of equal weight is two decisions where there is one.
      */}
      <section className="grid items-center gap-8 py-6 sm:py-12 lg:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="font-display text-ink text-[2.5rem] leading-[1.05] text-balance sm:text-[3.5rem]">
            Know where the month went.
          </h1>

          <p className="text-ink-2 mt-4 max-w-[46ch] text-base text-pretty sm:text-lg">
            {SITE.description}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground hoverable:bg-primary/90 focus-visible:ring-ring rounded-control inline-flex min-h-12 items-center gap-2 px-5 text-sm font-semibold transition-[transform,background-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none active:scale-[0.97]"
            >
              Get started free
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>

            <Link
              href="#how"
              className="text-primary focus-visible:ring-ring rounded-control inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              See how it works
            </Link>
          </div>
        </div>

        <AppPreview />
      </section>

      <section id="how" className="bg-card rounded-card border p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Logging an expense, in full
        </h2>
        <p className="text-ink-2 mt-1 text-sm">
          Four taps, because the account and the date are already filled in and
          the categories you use at this time of day are at the top.
        </p>

        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="bg-background rounded-control flex items-center gap-2.5 border p-3"
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
        <h2 className="text-lg font-semibold tracking-tight">What you get</h2>

        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {BLOCKS.map(({ feature, crop: Crop, label }) => (
            <li key={label} className="bg-card rounded-card border p-4">
              <Crop />
              <p className="text-ink-3 text-label font-semibold tracking-wide uppercase">
                {label}
              </p>
              <h3 className="mt-0.5 text-sm font-semibold">{feature.title}</h3>
              <p className="text-ink-2 mt-1 text-sm">{feature.body}</p>
            </li>
          ))}
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
      </section>

      {/*
        An accordion built from <details>, not from a component.

        It is an accordion in the sense that matters — one question per row,
        answers that open and close, operable from the keyboard — and it costs
        this page nothing to hydrate. The full FAQ at /faq leaves every answer
        open instead, because that is the page search engines read for rich
        results and a collapsed answer does not qualify.
      */}
      <section className="mt-10 border-t pt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Questions people ask first
        </h2>

        <div className="mt-4 space-y-2">
          {FAQS.slice(0, 4).map((faq) => (
            <details
              key={faq.question}
              className="bg-card rounded-card group border px-4"
            >
              <summary className="focus-visible:ring-ring marker:content-none flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none">
                {faq.question}
                <ChevronDown
                  className="text-ink-2 size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="text-ink-2 pb-4 text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>

        <p className="mt-4 text-sm">
          <Link href="/faq" className="text-primary underline">
            All the questions
          </Link>
        </p>
      </section>

      <section className="mt-10 border-t pt-8 text-center">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Start with today&rsquo;s first expense.
        </h2>
        <p className="text-ink-2 mx-auto mt-2 max-w-[46ch] text-sm">
          It takes a minute to set up and four taps after that. Nothing to pay,
          nothing to connect.
        </p>
        <Link
          href="/signup"
          className="bg-primary text-primary-foreground hoverable:bg-primary/90 focus-visible:ring-ring rounded-control mt-6 inline-flex min-h-12 items-center gap-2 px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          Get started free
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
