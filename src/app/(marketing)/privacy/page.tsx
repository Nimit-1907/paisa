import type { Metadata } from "next";

import Link from "next/link";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE.name} stores, who can read it, what it never collects, and how to take your records out or delete them.`,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: `Privacy · ${SITE.name}`,
    description: `What ${SITE.name} stores and what it never collects.`,
  },
};

/**
 * The privacy page.
 *
 * Written as what the code actually does, in the order someone worried would
 * ask it: what is kept, who can read it, what is never collected, and how to
 * leave. Every claim here is one the app can be checked against.
 */
export default function PrivacyPage() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Privacy
      </h1>
      <p className="text-text-secondary mt-3">
        Short version: {SITE.name} holds the records you type and the email
        address you signed up with. Nothing else, and nobody else.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">What is stored</h2>
        <ul className="text-text-secondary mt-2 list-disc space-y-1.5 pl-5 text-sm">
          <li>
            Your email address and a hashed password, so you can sign back in.
            A display name, if you set one.
          </li>
          <li>
            The records, accounts, categories, budgets and repeating rules you
            create: amounts, dates, notes and which account each one touched.
          </li>
          <li>
            Your preferences: currency symbol and decimals, which day your week
            starts on, and your theme.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Who can read it
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          You. Every table carries the id of the account that owns the row, and
          Postgres row level security refuses any query that asks for someone
          else&rsquo;s. That is a rule the database enforces on every read and
          write, not a filter the app has to remember to apply. That is the
          difference between a promise and a guarantee.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          What is never collected
        </h2>
        <ul className="text-text-secondary mt-2 list-disc space-y-1.5 pl-5 text-sm">
          <li>
            No bank credentials. {SITE.name} has no connection to any bank and
            never asks you to sign in to one.
          </li>
          <li>
            No analytics, no tracking pixels, no advertising identifiers, and
            no third-party scripts. The font is served from this site rather
            than from a font provider, so loading a page tells nobody else that
            you did.
          </li>
          <li>
            No location, no contacts, no device identifiers. Your records are
            never sold, shared or used to train anything.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Email</h2>
        <p className="text-text-secondary mt-2 text-sm">
          Your address is used for exactly three messages: confirming the
          account, resetting a password, and confirming an address change.
          There is no newsletter to unsubscribe from.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Taking it with you, or deleting it
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          The Export screen hands you every record as a CSV for any date range,
          or a month as a PDF. Deleting your account from Settings removes the
          login and every row that belongs to it in the same transaction: the
          records, the accounts, the budgets and the rules. It is immediate and
          it cannot be undone, which is why it asks you to type the word first.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Cookies</h2>
        <p className="text-text-secondary mt-2 text-sm">
          Two, both needed to keep you signed in, both set by this site. There
          is no consent banner because there is nothing here to consent to.
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/faq" className="text-text underline">
          Back to the questions
        </Link>
      </p>
    </div>
  );
}
