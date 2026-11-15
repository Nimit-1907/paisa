import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { StyleGuide } from "@/app/dev/style-guide/style-guide";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

/**
 * The Phase 14 design language, on one page, in both themes at once.
 *
 * Its job is comparison: every token, tint and component state sitting
 * beside the reference screenshots so a difference is visible rather than
 * argued about. It is also the cheapest regression test there is — a change
 * to a shared component shows up here on every state at once, including the
 * ones no screen happens to be showing today.
 *
 * Dev only. `notFound()` in production rather than a build-time exclusion,
 * because the page should also not exist for anyone who guesses the URL on
 * a preview deployment.
 */
export default function StyleGuidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <StyleGuide />;
}
