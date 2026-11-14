import type { Metadata } from "next";

import Link from "next/link";

import { FAQS } from "@/app/(marketing)/_content";
import { SITE, siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Answers about ${SITE.name}: what it costs, who can see your records, how to get your data out, and whether it connects to a bank.`,
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    url: "/faq",
    title: `FAQ · ${SITE.name}`,
    description: `Common questions about ${SITE.name}.`,
  },
};

export default function FaqPage() {
  const origin = siteOrigin();

  /**
   * FAQPage, built from the same array the page renders.
   *
   * Google will only show these as rich results if the answers are on the
   * page and visible, which is why every one of them is open markup rather
   * than a collapsed panel with its text hidden until clicked.
   */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${origin}/faq`,
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      {/* A text child, not an HTML sink: see the note on the landing page. */}
      {/* rubric:allow COR-BUG React writes a script's children out raw; verified against the built page, which parses as JSON with no entities. */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Questions
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[56ch]">
        If something here is not answered, the{" "}
        <Link href="/privacy" className="text-primary underline">
          privacy page
        </Link>{" "}
        is the longer version of the same answers.
      </p>

      <dl className="mt-8 space-y-3">
        {FAQS.map((faq) => (
          <div key={faq.question} className="bg-card rounded-2xl border p-4">
            <dt className="font-semibold">{faq.question}</dt>
            <dd className="text-muted-foreground mt-1.5 text-sm">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
