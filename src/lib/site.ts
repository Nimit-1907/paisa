/**
 * Who this site says it is, in one place.
 *
 * The origin is read from configuration rather than from the request's Host
 * header: metadata, the sitemap and the email links all need an absolute URL,
 * and a forged header would put someone else's domain in all three.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export const SITE = {
  name: "Paisa",
  tagline: "Expense tracker",
  /** The one sentence that has to work as a page title, an OG card and a pitch. */
  description:
    "A fast, private expense tracker for your phone. Log what you spend in four taps, set a budget for each category, and see where the month actually went.",
} as const;

